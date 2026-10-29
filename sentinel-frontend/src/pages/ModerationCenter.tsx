import { useState, useEffect } from 'react';
import {
  ShieldAlert, Search, Filter, CheckCircle, XCircle, AlertTriangle,
  Clock, Download, ChevronLeft, ChevronRight, X, ExternalLink,
  Send, Sparkles, RefreshCw, CheckCircle2, MessageSquare, ThumbsUp,
  ThumbsDown, HelpCircle, Layers, ArrowRight,
  Youtube, Instagram, Share2, Upload, FileText
} from 'lucide-react';
import { moderationApi, feedbackApi, analyzeApi } from '../api/client';
import type { ModerationRecord, ModerationDetail, AnalyzeResponse } from '../types';
import { useToast } from '../App';

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

const TEST_PRESETS = [
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

export default function ModerationCenter() {
  // Live Analysis State
  const [commentInput, setCommentInput] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalyzeResponse | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<string | null>(null);

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
  const [platformFilter, setPlatformFilter] = useState('');

  // Selected record for details/drawer
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

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim()) {
      addToast('Please enter text to analyze', 'warning');
      return;
    }
    setAnalyzing(true);
    setFeedbackSubmitted(null);
    try {
      const resp = await analyzeApi.analyze({
        text: commentInput.trim(),
        language_hint: selectedLanguage || undefined,
      });
      setLatestAnalysis(resp.data);
      addToast(`Analysis complete: ${resp.data.decision.replace(/_/g, ' ')}`, 'success');
      // Automatically refresh moderation records so the new comment appears in the queue
      await fetchRecords();
    } catch (err: any) {
      addToast(err.message || 'Analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleInlineFeedback = async (
    type: 'correct' | 'false_positive' | 'false_negative' | 'ambiguous'
  ) => {
    if (!latestAnalysis) return;
    try {
      await feedbackApi.submit({
        record_id: latestAnalysis.id,
        is_confirmed: type === 'correct',
        is_false_positive: type === 'false_positive',
        is_false_negative: type === 'false_negative',
        is_ambiguous: type === 'ambiguous',
        predicted_severity: latestAnalysis.severity,
        corrected_severity: type === 'false_positive' ? 'low' : (type === 'false_negative' ? 'high' : latestAnalysis.severity),
        explanation: `In-line analysis feedback: ${type}`,
        language: latestAnalysis.detected_language,
        model_version: latestAnalysis.model_version,
      });
      setFeedbackSubmitted(type);
      addToast(`Feedback (${type.replace(/_/g, ' ')}) recorded successfully.`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to submit feedback', 'error');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const resp = await moderationApi.getDetail(id);
      setDetail(resp.data);
      setCorrectedSeverity(resp.data.severity);
      setOverrideReason('');
      setReviewerNotes('');
    } catch (err: any) {
      addToast(err.message || 'Failed to load details', 'error');
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
        reviewer_id: 'moderator_lead',
        reviewer_name: 'Lead Compliance Officer',
      });

      // Synchronize human ground-truth feedback for continuous learning and error analysis
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
        explanation: overrideReason || reviewerNotes || `Moderator review decision: ${reviewAction}`,
        language: detail?.detected_language,
        model_version: detail?.model_version,
      });

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

  return (
    <div className="space-y-8 max-w-screen-2xl page-enter pb-12">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] shadow-xs">
            <ShieldAlert className="w-5 h-5 text-[#6C5CE7]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#20212B] tracking-tight">Moderator Command Center</h1>
            </div>
            <p className="text-xs text-[#858795] mt-0.5">
              Analyze individual multilingual comments with calibrated local models, submit active feedback, and audit flagged queue items.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] text-[#20212B] text-xs font-medium shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#6C5CE7]" />
            <span>Export to CSV</span>
          </button>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] text-[#20212B] text-xs font-medium shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#6C5CE7]' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          TOP SECTION: INTERACTIVE COMMENT ANALYSIS WORKSPACE
          ═════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-6 space-y-5 rounded-2xl border border-[#E9EAF1] shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7]">
              <Sparkles className="w-4 h-4 text-[#6C5CE7]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#20212B] tracking-wide">
                Interactive Comment Analysis Workspace
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#858795] font-medium">Routing Script:</span>
            <select
              value={selectedLanguage}
              onChange={e => setSelectedLanguage(e.target.value)}
              className="px-2.5 py-1 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">Auto-Detect Language</option>
              <option value="english">English (word+char v2)</option>
              <option value="telugu">Telugu (generalization v3)</option>
              <option value="hindi">Hindi (hostility v1)</option>
              <option value="hinglish">Hinglish (contextual v2)</option>
              <option value="kannada">Kannada (word+char v2)</option>
            </select>
          </div>
        </div>

        {/* 1-Click Quick Preset Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[#858795] text-[11px] font-medium mr-1">Quick Presets:</span>
          {TEST_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCommentInput(p.text);
                setSelectedLanguage(p.lang);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#F8F9FE] hover:bg-[#EEEAFE]/40 border border-[#E9EAF1] hover:border-[#6C5CE7] text-[11px] text-[#20212B] transition-all flex items-center gap-1.5"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${p.type === 'harmful' ? 'bg-[#FF7675]' : 'bg-[#00B894]'}`} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAnalyze} className="space-y-3">
          <div className="relative">
            <textarea
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              rows={3}
              placeholder="Type or paste a comment in Telugu, Hindi, Hinglish, Kannada, or English..."
              className="w-full px-4 py-3 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-sm text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-[#6C5CE7] transition-colors"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-3">
              <span className="text-[10px] text-[#858795] font-mono">
                {commentInput.length} chars
              </span>
              {commentInput && (
                <button
                  type="button"
                  onClick={() => setCommentInput('')}
                  className="text-xs text-[#858795] hover:text-[#20212B]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={analyzing || !commentInput.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating Multilingual Pipeline...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Analyze Comment</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Analysis Result Panel */}
        {latestAnalysis && (
          <div className="p-5 rounded-2xl bg-[#F8F9FE] border border-[#DDD6FE] space-y-4 page-enter shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#E9EAF1]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#6C5CE7]" />
                <span className="text-xs font-bold text-[#20212B]">Live Prediction Output</span>
                <span className="text-[10px] text-[#858795] font-mono">
                  (Record: {latestAnalysis.id ? latestAnalysis.id.slice(0, 8) : 'temp'})
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-[#858795]">Latency:</span>
                <span className="text-[#6C5CE7] font-semibold">{latestAnalysis.processing_time_ms ? `${latestAnalysis.processing_time_ms.toFixed(1)} ms` : '< 3 ms'}</span>
                <span className="text-[#858795]">•</span>
                <span className="text-[#6C5CE7] font-semibold">{latestAnalysis.model_name}</span>
              </div>
            </div>

            {/* Verdict Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className={`p-3.5 rounded-xl border ${
                latestAnalysis.decision === 'flag_for_review' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                latestAnalysis.decision === 'human_review' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}>
                <div className="text-[11px] opacity-80 font-medium">Model Decision</div>
                <div className="text-base font-black capitalize mt-1">
                  {latestAnalysis.decision.replace(/_/g, ' ')}
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  Action: {latestAnalysis.recommended_action}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#E9EAF1] shadow-xs">
                <div className="text-[11px] text-[#858795]">Toxicity Assessment</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-lg font-black text-[#20212B] tabular-nums">
                    {latestAnalysis.toxicity_prediction ? `${(latestAnalysis.toxicity_prediction.toxicity_score * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    latestAnalysis.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    latestAnalysis.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {latestAnalysis.severity} Harm
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full ${
                      (latestAnalysis.toxicity_prediction?.toxicity_score || 0) > 0.5 ? 'bg-[#FF7675]' : 'bg-[#00B894]'
                    }`}
                    style={{ width: `${Math.min(100, (latestAnalysis.toxicity_prediction?.toxicity_score || 0) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#E9EAF1] shadow-xs">
                <div className="text-[11px] text-[#858795]">Linguistic Route</div>
                <div className="text-base font-black text-[#6C5CE7] capitalize mt-1">
                  {latestAnalysis.detected_language}
                </div>
                <div className="text-[10px] text-[#858795] mt-0.5">
                  Route Status: {latestAnalysis.language_route?.status?.replace(/_/g, ' ') || 'validated'}
                </div>
              </div>
            </div>

            {/* Severity Evidence */}
            {latestAnalysis.severity_reason && (
              <div className="p-3 rounded-xl bg-white border border-[#E9EAF1] text-xs text-[#20212B]">
                <span className="text-[#858795] font-semibold mr-1.5">Reasoning:</span>
                {latestAnalysis.severity_reason}
              </div>
            )}

            {/* In-Line Human-in-the-Loop Feedback Controls */}
            <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs text-[#858795]">
                <span className="font-medium">Submit Human Verification:</span>
                {feedbackSubmitted && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Verified as {feedbackSubmitted.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleInlineFeedback('correct')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    feedbackSubmitted === 'correct'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <ThumbsUp className="w-3 h-3" />
                  <span>Confirm Correct</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleInlineFeedback('false_positive')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    feedbackSubmitted === 'false_positive'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                  }`}
                >
                  <ThumbsDown className="w-3 h-3" />
                  <span>False Positive</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleInlineFeedback('false_negative')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    feedbackSubmitted === 'false_negative'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>False Negative</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleInlineFeedback('ambiguous')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    feedbackSubmitted === 'ambiguous'
                      ? 'bg-[#6C5CE7] text-white border-[#6C5CE7] shadow-xs'
                      : 'bg-[#EEEAFE] hover:bg-purple-100 text-[#6C5CE7] border-[#DDD6FE]'
                  }`}
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Mark Ambiguous</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          BOTTOM SECTION: MODERATION QUEUE & FILTER CONTROLS
          ═════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Filter and Search Bar */}
        <div className="bg-white p-4 flex flex-wrap gap-3 items-center justify-between rounded-2xl border border-[#E9EAF1] shadow-xs">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858795]" />
              <input
                type="text"
                placeholder="Search comments, content or record IDs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-[#6C5CE7]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1 text-[#858795] font-medium">
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
              className="px-2.5 py-1.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">All Languages</option>
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="telugu">Telugu</option>
              <option value="hinglish">Hinglish</option>
              <option value="kannada">Kannada</option>
            </select>

            <select
              value={platformFilter}
              onChange={e => { setPlatformFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">All Platforms</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="manual">Manual Direct</option>
              <option value="csv_upload">CSV Import</option>
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
                }}
                className="text-xs text-[#6C5CE7] hover:underline font-medium px-2"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Main Records Table */}
        <div className="bg-white overflow-hidden rounded-2xl border border-[#E9EAF1] shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F9FE] border-b border-[#E9EAF1] text-[#858795] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Comment Text</th>
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
                  [...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="py-4 px-4">
                        <div className="h-5 w-full bg-[#F5F6FA] rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#858795]">
                      No moderation records match your current criteria.
                    </td>
                  </tr>
                ) : (
                  records.map(rec => (
                    <tr key={rec.id} className="hover:bg-[#F8F9FE] transition-colors">
                      <td className="py-3 px-4 max-w-md">
                        <div className="text-[#20212B] line-clamp-2 font-medium">{rec.original_text}</div>
                        {rec.author_name && (
                          <div className="text-[10px] text-[#858795] font-normal mt-0.5">
                            by @{rec.author_name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <PlatformBadge platform={rec.platform} sourceUrl={rec.source_url} />
                      </td>
                      <td className="py-3 px-3">
                        <span className="capitalize px-2.5 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] text-[10px] font-semibold">
                          {rec.detected_language}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          rec.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          rec.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          rec.severity === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-[#F5F6FA] text-[#858795] border-[#E9EAF1]'
                        }`}>
                          {rec.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-[11px] text-[#858795]">
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
                      <td className="py-3 px-3">
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
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openDetail(rec.id)}
                          className="px-3 py-1 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-xs font-semibold transition-colors"
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
          <div className="p-3.5 bg-white border-t border-[#E9EAF1] flex items-center justify-between text-xs text-[#858795]">
            <div>
              Showing <span className="text-[#20212B] font-semibold">{records.length}</span> of <span className="text-[#20212B] font-semibold">{total}</span> queue items
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-[#F8F9FE] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#20212B] disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="tabular-nums">Page {page} of {totalPages || 1}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-[#F8F9FE] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#20212B] disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          SLIDE-OVER REVIEW DRAWER / MODAL
          ═════════════════════════════════════════════════════════════════════════ */}
      {selectedId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white border-l border-[#E9EAF1] h-full overflow-y-auto p-6 space-y-6 shadow-2xl slide-in-right">
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
                className="text-[#858795] hover:text-[#20212B] p-1.5 rounded-lg hover:bg-[#F5F6FA]"
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
                      {detail.author_name && <span>Author: <strong className="text-[#20212B]">@{detail.author_name}</strong></span>}
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#20212B]">Moderator Decision</h3>

                  <div>
                    <label className="block text-[11px] font-medium text-[#858795] mb-2">Consequential Action</label>
                    <div className="grid grid-cols-2 gap-2">
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
                          className={`p-3 rounded-xl border text-left transition-all ${
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
                      placeholder="Optional notes for moderator team..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedId(null); setDetail(null); }}
                      className="px-4 py-2 rounded-xl bg-[#F5F6FA] hover:bg-[#E9EAF1] text-[#20212B] text-xs font-medium border border-[#E9EAF1] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-5 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all disabled:opacity-50"
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
