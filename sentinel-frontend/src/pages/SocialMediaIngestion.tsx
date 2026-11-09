import { useState, useRef, useEffect } from 'react';
import {
  Activity, Youtube, Instagram, FileText, Upload,
  CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Sparkles, ShieldCheck, ArrowRight, Check, RotateCcw,
  Sliders, Database, ExternalLink, Filter, Layers, ListFilter
} from 'lucide-react';
import { monitoringApi, socialApi } from '../api/client';
import { useToast } from '../App';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';

export default function SocialMediaIngestion() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const storageKeyActiveCsvJob = `sentinel_active_csv_job_${user?.id || 'guest'}`;
  const {
    ingestMode, setIngestMode,
    batchText, setBatchText,
    csvFile, setCsvFile,
    deduplicate, setDeduplicate,
    batchResult, setBatchResult,
    sessionBatchCount, setSessionBatchCount,
    sessionCommentsProcessed, setSessionCommentsProcessed,
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
  const [customPlatform, setCustomPlatform] = useState<'direct'>('direct');
  const [customLangHint, setCustomLangHint] = useState<string>('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Dynamic Schema & Background Job State
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [detectedCommentCol, setDetectedCommentCol] = useState<string | null>(null);
  const [selectedCommentCol, setSelectedCommentCol] = useState<string>('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [csvJobId, setCsvJobId] = useState<string | null>(null);
  const [csvProgress, setCsvProgress] = useState<number>(0);
  const [csvProcessed, setCsvProcessed] = useState<number>(0);
  const [csvTotal, setCsvTotal] = useState<number>(0);
  const [csvFlagged, setCsvFlagged] = useState<number>(0);
  const [csvApproved, setCsvApproved] = useState<number>(0);
  const [csvDuplicates, setCsvDuplicates] = useState<number>(0);
  const [csvFailed, setCsvFailed] = useState<number>(0);
  const [csvProcessing, setCsvProcessing] = useState<boolean>(false);
  const pollingRef = useRef<any>(null);

  // Comment Retrieval Count state ('default' | '10' | '25' | '50' | '100' | '250' | '500' | 'custom')
  const [ytCountSelect, setYtCountSelect] = useState<string>('default');
  const [ytCustomValue, setYtCustomValue] = useState<number>(50);

  const [igCountSelect, setIgCountSelect] = useState<string>('default');
  const [igCustomValue, setIgCustomValue] = useState<number>(50);

  // Quick Preset samples for manual entry
  const DIRECT_PRESETS = [
    'Great informative explanation, really appreciate the breakdown!',
    'This argument is completely ridiculous and you clearly do not understand.',
    'మీ వివరణ చాలా బాగుంది, ధన్యవాదాలు! (Great explanation, thanks!)',
    'तू बहुत ही घटिया इंसान है, यहां से निकल जा (Hostile comment)'
  ];

  const handleApplyPreset = (textToAdd: string) => {
    setBatchText(batchText ? `${batchText}\n${textToAdd}` : textToAdd);
    addToast('Preset comment added to ingestion buffer.', 'info');
  };

  // 1. Handle Custom Manual Comment Ingestion (Requirement 1)
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

      setBatchResult(resp.data);
      setSessionBatchCount(prev => prev + 1);
      setSessionCommentsProcessed(prev => prev + (resp.data.processed_count || rawLines.length));
      addToast(`Successfully analyzed ${resp.data.processed_count} ${platformLabel} comments. Dashboard synchronized.`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Custom comment analysis failed.', 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  // CSV File Selection with Pre-detection
  const handleFileSelect = async (file: File) => {
    setCsvFile(file);
    try {
      const resp = await monitoringApi.previewCsv(file);
      if (resp.data) {
        setCsvColumns(resp.data.columns || []);
        setDetectedCommentCol(resp.data.detected_column || null);
        setSelectedCommentCol(resp.data.detected_column || (resp.data.columns && resp.data.columns[0]) || '');
        setCsvPreviewRows(resp.data.preview_rows || []);
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

          setBatchResult({
            monitoring_mode: 'local_offline_pipeline',
            platform_notice: 'Batch CSV benchmark analyzed with vectorized multilingual pipeline.',
            total_received: (data.total_records || 0) + (data.duplicate_count || 0),
            processed_count: data.processed_count || 0,
            duplicate_count: data.duplicate_count || 0,
            flagged_count: data.flagged_count || 0,
            approved_count: data.approved_count || 0,
            failed_count: data.failed_count || 0,
            severity_breakdown: data.severity_breakdown || {},
            language_breakdown: data.language_breakdown || {},
            processing_time_ms: data.processing_time_ms || 0,
            items: data.items || []
          });
          setSessionBatchCount(prev => prev + 1);
          setSessionCommentsProcessed(prev => prev + (data.processed_count || 0));
          addToast(`CSV Ingestion completed! Analyzed ${data.processed_count} comments in ${((data.processing_time_ms || 0) / 1000).toFixed(1)}s`, 'success');
        } else if (data.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setCsvProcessing(false);
          setIsIngesting(false);
          localStorage.removeItem(storageKeyActiveCsvJob);
          addToast(data.error_message || 'CSV processing failed in background.', 'error');
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setCsvProcessing(false);
          setIsIngesting(false);
          localStorage.removeItem(storageKeyActiveCsvJob);
        }
      }
    }, 700);
  };

  // Restore active CSV background job on mount (tab persistence)
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

  // 2. Handle CSV File Ingestion (Background Job with Progress Tracking)
  const handleCsvIngest = async () => {
    if (isIngesting || csvProcessing) return;
    if (!csvFile) {
      addToast('Please select a CSV or text dataset file.', 'error');
      return;
    }
    setIsIngesting(true);
    setCsvProcessing(true);
    setCsvProgress(0);
    try {
      const resp = await monitoringApi.uploadCsv(
        csvFile,
        deduplicate,
        csvFile.name.replace(/\.[^/.]+$/, ''),
        undefined,
        selectedCommentCol || undefined,
        true
      );
      const resData = resp.data as any;
      if (resData && resData.job_id) {
        const jobId = resData.job_id;
        setCsvJobId(jobId);
        localStorage.setItem(storageKeyActiveCsvJob, jobId);
        setCsvTotal(resData.total_records || 0);
        setCsvDuplicates(resData.duplicate_count || 0);
        addToast(`Uploaded ${resData.total_records} rows. Moderating in background...`, 'info');
        pollCsvJob(jobId);
      } else {
        // Synchronous fallback
        setBatchResult(resData);
        setSessionBatchCount(prev => prev + 1);
        setSessionCommentsProcessed(prev => prev + resData.processed_count);
        addToast(`CSV Ingestion completed: ${resData.processed_count} rows processed.`, 'success');
        setIsIngesting(false);
        setCsvProcessing(false);
      }
    } catch (err: any) {
      setIsIngesting(false);
      setCsvProcessing(false);
      addToast(err.message || 'CSV ingestion failed.', 'error');
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

      const resData = resp.data as any;
      setBatchResult({
        monitoring_mode: 'youtube_live_stream',
        platform_notice: 'Real-time YouTube ingestion analyzed via calibrated local multilingual model.',
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
      addToast(`Retrieved and classified ${resData.total_fetched} of ${count} requested YouTube comments!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'YouTube comment ingestion failed.', 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  // 4. Handle Instagram Live Fetch (if credentials present)
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
      const resData = resp.data as any;
      setBatchResult({
        monitoring_mode: 'instagram_live_stream',
        platform_notice: 'Real-time Instagram ingestion analyzed via local offline models.',
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
      addToast(`Retrieved and classified ${resData.total_fetched} of ${count} requested Instagram comments!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Instagram API fetch failed. You can paste comments manually above.', 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  const parsedLinesCount = batchText.split('\n').map(l => l.trim()).filter(Boolean).length;

  return (
    <div className="space-y-6 page-enter pb-12">
      {/* ── Page Header ── */}
      <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live Ingestion SOC Active
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6C5CE7] bg-[#EEEAFE] px-2 py-0.5 rounded-full border border-[#DDD6FE]">
              100% Offline Inference
            </span>
          </div>
          <h1 className="text-xl font-black text-[#20212B] tracking-tight mt-1.5 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#6C5CE7]" />
            <span>Social Media Ingestion &amp; Comment Pipeline</span>
          </h1>
          <p className="text-xs text-[#858795] mt-1 max-w-3xl leading-relaxed">
            Custom manual YouTube and Instagram comment entry, live URL fetching, and batch CSV dataset processing. All comments are analyzed locally with offline multilingual models and synced to Dashboard analytics.
          </p>
        </div>

        {/* Global Reset */}
        <button
          type="button"
          onClick={() => {
            clearWorkspace();
            addToast('Ingestion workspace cleared.', 'info');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] hover:bg-[#F0F1F5] text-[#858795] hover:text-[#20212B] text-xs font-semibold transition-all shadow-xs cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Workspace</span>
        </button>
      </div>

      {/* ── Ingestion Mode Navigation Cards ── */}
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
            {ingestMode === 'text' && <span className="w-2 h-2 rounded-full bg-[#6C5CE7]" />}
          </div>
          <h3 className="text-sm font-bold text-[#20212B]">Custom Manual Entry</h3>
          <p className="text-[11px] text-[#858795] mt-0.5">
            Paste one or multiple comments from YouTube or Instagram manually.
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
            {(ingestMode === 'youtube' || ingestMode === 'instagram') && <span className="w-2 h-2 rounded-full bg-rose-500" />}
          </div>
          <h3 className="text-sm font-bold text-[#20212B]">Live Social Media URLs</h3>
          <p className="text-[11px] text-[#858795] mt-0.5">
            Fetch and moderate comments directly from public YouTube or Instagram posts.
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
            {ingestMode === 'csv' && <span className="w-2 h-2 rounded-full bg-[#6C5CE7]" />}
          </div>
          <h3 className="text-sm font-bold text-[#20212B]">Batch CSV / File Upload</h3>
          <p className="text-[11px] text-[#858795] mt-0.5">
            Ingest structured benchmark datasets with deduplication and auto-delimiter.
          </p>
        </button>
      </div>

      {/* ── Main Ingestion Console Area ── */}
      <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-xs space-y-5">
        
        {/* ═══════════════════════════════════════════════════════════════════════
            MODE 1: CUSTOM MANUAL YOUTUBE / INSTAGRAM COMMENT ENTRY (Requirement 1)
            ═══════════════════════════════════════════════════════════════════════ */}
        {ingestMode === 'text' && (
          <div className="space-y-5">
            {/* Platform Selection */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#E9EAF1]">
              <div>
                <label className="text-xs font-bold text-[#20212B] block">Select Platform Source for Custom Comments:</label>
                <p className="text-[11px] text-[#858795]">Records will be tagged and stored under this platform source for analytics.</p>
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
                Quick Direct Text Samples:
              </span>
              {DIRECT_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 rounded-lg bg-[#F8F9FE] hover:bg-[#EEEAFE] text-[#6C5CE7] border border-[#E9EAF1] text-[11px] font-medium transition-colors truncate max-w-[240px] cursor-pointer"
                  title={p}
                >
                  + "{p.slice(0, 32)}..."
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
                placeholder={"Paste user comments here...\nOne comment per line.\nExample:\nGreat explanation, very helpful!\nThis is completely unacceptable and ridiculous.\nమీ వివరణ చాలా బాగుంది"}
                className="w-full p-4 rounded-xl border border-[#E9EAF1] bg-[#FBFBFE] text-xs font-mono text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7] focus:bg-white transition-all resize-y"
              />
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Language Hint Override */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#858795] font-medium">Language Hint:</label>
                  <select
                    value={customLangHint}
                    onChange={(e) => setCustomLangHint(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] text-xs text-[#20212B] font-medium focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                  >
                    <option value="">Auto-Detect Script</option>
                    <option value="english">English (Latin)</option>
                    <option value="hindi">Hindi (Devanagari)</option>
                    <option value="telugu">Telugu (తెలుగు)</option>
                    <option value="kannada">Kannada (ಕನ್ನಡ)</option>
                    <option value="hinglish">Hinglish (Code-Mixed)</option>
                  </select>
                </div>

                {/* Deduplicate Checkbox */}
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
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-md shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Comments...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze &amp; Moderate {parsedLinesCount > 0 ? `(${parsedLinesCount})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            MODE 2: SOCIAL MEDIA LIVE URL FETCHING
            ═══════════════════════════════════════════════════════════════════════ */}
        {(ingestMode === 'youtube' || ingestMode === 'instagram') && (
          <div className="space-y-5">
            {/* Sub-Tabs for YouTube vs Instagram URL Ingestion */}
            <div className="flex items-center gap-2 border-b border-[#E9EAF1] pb-3">
              <button
                type="button"
                onClick={() => setIngestMode('youtube')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  ingestMode === 'youtube'
                    ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-xs'
                    : 'bg-[#F8F9FE] text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
                }`}
              >
                <Youtube className="w-4 h-4 text-rose-600" />
                <span>YouTube Comment Detector</span>
              </button>

              <button
                type="button"
                onClick={() => setIngestMode('instagram')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  ingestMode === 'instagram'
                    ? 'bg-pink-50 text-pink-700 border-pink-300 shadow-xs'
                    : 'bg-[#F8F9FE] text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
                }`}
              >
                <Instagram className="w-4 h-4 text-pink-600" />
                <span>Instagram Comment Detector</span>
              </button>
            </div>

            {/* YouTube URL Form */}
            {ingestMode === 'youtube' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#20212B] mb-1">
                    YouTube Video URL or Video ID:
                  </label>
                  <div className="relative">
                    <Youtube className="w-4 h-4 text-rose-600 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={ytVideoInput}
                      onChange={(e) => setYtVideoInput(e.target.value)}
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                  {/* Quick Preset YouTube Videos */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="text-[11px] text-[#858795] font-semibold">
                      Sample Public Videos:
                    </span>
                    {[
                      { label: '🇮🇳 India Tech Talk', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
                      { label: '🎬 Telugu Cinema Review', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
                      { label: '🔥 Hindi Debate Highlights', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0' },
                    ].map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setYtVideoInput(s.url);
                          addToast(`Loaded ${s.label}`, 'info');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-medium transition-colors cursor-pointer"
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
                      <option value="default">Default (50)</option>
                      <option value="10">10 comments</option>
                      <option value="25">25 comments</option>
                      <option value="50">50 comments</option>
                      <option value="100">100 comments</option>
                      <option value="250">250 comments</option>
                      <option value="500">500 comments</option>
                      <option value="custom">Custom</option>
                    </select>

                    {/* Numeric input displayed immediately below when Custom is selected */}
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
                        <p className="text-[10px] text-[#858795]">
                          Specify custom count between 1 and 500 comments.
                        </p>
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
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isIngesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Fetching YouTube Comments...</span>
                      </>
                    ) : (
                      <>
                        <Youtube className="w-4 h-4 text-white" />
                        <span>Fetch &amp; Moderate YouTube Comments</span>
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
                      placeholder="e.g. https://www.instagram.com/p/C4xyz123/ or 1801234567890"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-pink-500 font-mono"
                    />
                  </div>
                  {/* Quick Preset Instagram Reels */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="text-[11px] text-[#858795] font-semibold">
                      Sample Public Reels:
                    </span>
                    {[
                      { label: '🎬 Viral Indic Tech Reel', url: 'https://www.instagram.com/reel/C7xTechIndia/' },
                      { label: '📸 Telugu Creator Post', url: 'https://www.instagram.com/p/C9TeluguBuzz/' },
                      { label: '🔥 Hindi & Hinglish Reel', url: 'https://www.instagram.com/reel/C8HindiHumor/' },
                      { label: '✨ Kannada Community Reel', url: 'https://www.instagram.com/reel/C6KarnatakaDaily/' },
                    ].map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIgMediaInput(s.url);
                          addToast(`Loaded ${s.label}`, 'info');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 text-[10px] font-medium transition-colors cursor-pointer"
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
                      <option value="default">Default (50)</option>
                      <option value="10">10 comments</option>
                      <option value="25">25 comments</option>
                      <option value="50">50 comments</option>
                      <option value="100">100 comments</option>
                      <option value="250">250 comments</option>
                      <option value="500">500 comments</option>
                      <option value="custom">Custom</option>
                    </select>

                    {/* Numeric input displayed immediately below when Custom is selected */}
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
                        <p className="text-[10px] text-[#858795]">
                          Specify custom count between 1 and 500 comments.
                        </p>
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
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-pink-600/25 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isIngesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Fetching Instagram Comments...</span>
                      </>
                    ) : (
                      <>
                        <Instagram className="w-4 h-4 text-white" />
                        <span>Fetch &amp; Moderate Instagram Comments</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            MODE 3: BATCH CSV / FILE INGESTION (High-Performance Vectorized Background Pipeline)
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

            {/* Column Detection & Manual Selection Card */}
            {csvColumns.length > 0 && (
              <div className="p-4 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#6C5CE7]" />
                    <span className="text-xs font-bold text-[#20212B]">Detected Columns &amp; Schema Mapping</span>
                  </div>
                  {detectedCommentCol && (
                    <span className="text-[10px] bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] px-2.5 py-0.5 rounded-full font-semibold">
                      Auto-detected: "{detectedCommentCol}"
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

            {/* Live Progress Bar & Telemetry Card when background job is running */}
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

                <p className="text-[10px] text-[#858795] text-center pt-0.5">
                  Vectorized multilingual batches running locally. You can switch to other tabs or refresh — background job will continue.
                </p>
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

      {/* ── Batch Result Telemetry & Live Results Banner ── */}
      {batchResult && (
        <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-xs space-y-4 page-enter">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#E9EAF1]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#20212B]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Ingestion Completed in {batchResult.processing_time_ms ? `${batchResult.processing_time_ms.toFixed(1)} ms` : '0 ms'}
              </span>
              <span className="text-[10px] text-[#6C5CE7] bg-[#EEEAFE] border border-[#6C5CE7]/20 px-2.5 py-0.5 rounded-full font-semibold">
                Dashboard &amp; Telemetry Synchronized
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] tabular-nums flex-wrap">
              {batchResult.requested_count !== undefined && (
                <span className="px-2.5 py-1 rounded-lg bg-white text-[#6C5CE7] border border-[#DDD6FE] font-bold">
                  Requested: {batchResult.requested_count}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-[#F8F9FE] text-[#20212B] border border-[#E9EAF1] font-semibold">
                Retrieved: {batchResult.total_fetched ?? batchResult.total_received ?? batchResult.processed_count}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                Duplicates: {batchResult.duplicate_count ?? 0}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#F8F9FE] text-[#858795] border border-[#E9EAF1] font-semibold">
                Failed: {batchResult.failed_count ?? 0}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                Flagged: {batchResult.flagged_count}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Approved: {batchResult.approved_count}
              </span>
            </div>
          </div>

          {/* Results Table */}
          <div className="overflow-x-auto rounded-xl border border-[#E9EAF1] max-h-80 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] font-semibold uppercase tracking-wider text-[10px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3.5">Comment Text</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3">Language</th>
                  <th className="py-2.5 px-3">Toxicity / Harm</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3.5 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F5]">
                {(batchResult.items || batchResult.records || []).map((it: any, idx: number) => {
                  const tox = it.toxicity_score !== null && it.toxicity_score !== undefined
                    ? `${(it.toxicity_score * 100).toFixed(0)}%`
                    : null;
                  const isHigh = it.severity === 'high';
                  const isMed = it.severity === 'medium';
                  const platformTag = it.platform || 'Direct';

                  return (
                    <tr key={it.id || idx} className="hover:bg-[#F8F9FE] transition-colors">
                      <td className="py-2.5 px-3.5 font-medium text-[#20212B] max-w-md truncate">
                        {it.text || it.original_text}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          String(platformTag).toLowerCase().includes('youtube')
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : String(platformTag).toLowerCase().includes('instagram')
                            ? 'bg-pink-50 text-pink-700 border-pink-200'
                            : 'bg-[#EEEAFE] text-[#6C5CE7] border-[#DDD6FE]'
                        }`}>
                          {String(platformTag).toLowerCase().includes('youtube') && <Youtube className="w-3 h-3 text-rose-600" />}
                          {String(platformTag).toLowerCase().includes('instagram') && <Instagram className="w-3 h-3 text-pink-600" />}
                          <span>{platformTag}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="capitalize text-[10px] px-2 py-0.5 rounded-full bg-[#F5F6FA] text-[#6C5CE7] border border-[#E9EAF1] font-semibold">
                          {it.detected_language || 'english'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold">
                        {tox ? (
                          <span className={it.toxicity_score >= 0.4 ? 'text-rose-600' : 'text-emerald-600'}>
                            {tox}
                          </span>
                        ) : (
                          <span className="text-[#858795]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          isHigh ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          isMed ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {it.severity || 'low'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          it.decision !== 'no_action'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {it.decision === 'flag_for_review' ? 'Flagged for Review' :
                           it.decision === 'human_review' ? 'Escalated to Human' :
                           'Approved'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-[11px] text-[#858795] whitespace-nowrap">
                        {it.processing_time_ms ? `${it.processing_time_ms.toFixed(1)}ms` : '< 5ms'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
