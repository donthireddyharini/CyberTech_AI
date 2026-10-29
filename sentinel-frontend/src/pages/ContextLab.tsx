import { useState, useRef, useEffect } from 'react';
import {
  FlaskConical, Send, RotateCcw, AlertCircle,
  Info, ArrowRight, Globe, ChevronDown, ChevronUp,
  Layers, SplitSquareHorizontal, CheckCircle2,
  TrendingUp, TrendingDown, Scale, ShieldAlert, Sparkles,
  MessageSquare, PlusCircle, Trash2, Clock, Check,
  ExternalLink, User, Bot, ShieldCheck
} from 'lucide-react';
import { analyzeApi } from '../api/client';
import type { AnalyzeResponse, CompareTextsResponse, ChatMessage, ScoreDiffItem } from '../types';
import { useToast } from '../App';
import { useContextLab } from '../context/ContextLabContext';

// ─── 12 CULTURALLY APPROPRIATE COMPACT SAMPLE SCENARIOS ───────────────────────
interface SampleScenario {
  id: string;
  langLabel: string;
  scenarioLabel: string;
  langHint: string;
  text: string;
  dotColor: string;
}

const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: 'en_civil',
    langLabel: 'English',
    scenarioLabel: 'Harmless / Civil',
    langHint: 'english',
    text: 'I appreciate this clear and well-structured breakdown of the topic, thank you for sharing.',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'en_mild',
    langLabel: 'English',
    scenarioLabel: 'Mild Insult',
    langHint: 'english',
    text: 'This is a completely ridiculous argument and you clearly do not understand how it works.',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'en_harass',
    langLabel: 'English',
    scenarioLabel: 'Targeted Harassment',
    langHint: 'english',
    text: 'You are an absolute pathetic clown and nobody wants you posting here, just delete your account.',
    dotColor: 'bg-rose-500',
  },
  {
    id: 'en_threat',
    langLabel: 'English',
    scenarioLabel: 'Explicit Threat',
    langHint: 'english',
    text: 'I will find where you live and hurt you for what you posted.',
    dotColor: 'bg-rose-600',
  },
  {
    id: 'hi_civil',
    langLabel: 'Hindi',
    scenarioLabel: 'Harmless / Civil',
    langHint: 'hindi',
    text: 'यह बहुत ही सुंदर और उपयोगी व्याख्यान है, साझा करने के लिए आपका बहुत-बहुत धन्यवाद।',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'hi_hostile',
    langLabel: 'Hindi',
    scenarioLabel: 'Hostile / Harassment',
    langHint: 'hindi',
    text: 'तू बहुत ही घटिया और बदतमीज इंसान है, अपनी बकवास यहां बंद कर।',
    dotColor: 'bg-rose-500',
  },
  {
    id: 'te_civil',
    langLabel: 'Telugu',
    scenarioLabel: 'Harmless / Civil',
    langHint: 'telugu',
    text: 'చాలా చక్కగా వివరించారు, ఈ సమాచారం అందరికీ ఎంతో ఉపయోగపడుతుంది.',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'te_insult',
    langLabel: 'Telugu',
    scenarioLabel: 'Insult / Harassment',
    langHint: 'telugu',
    text: 'నువ్వు చాలా పనికిరాని వెధవవి, అసలు మాట్లాడటం మానేయి.',
    dotColor: 'bg-rose-500',
  },
  {
    id: 'kn_civil',
    langLabel: 'Kannada',
    scenarioLabel: 'Harmless / Civil',
    langHint: 'kannada',
    text: 'ತುಂಬಾ ಉಪಯುಕ್ತವಾದ ಮಾಹಿತಿ ಮತ್ತು ವಿವರಣೆ, ಹಂಚಿಕೊಂಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'kn_insult',
    langLabel: 'Kannada',
    scenarioLabel: 'Insult / Harassment',
    langHint: 'kannada',
    text: 'ನೀನು ತುಂಬಾ ಕೆಟ್ಟವನು ಮತ್ತು ಅಸಹ್ಯ, ಇಲ್ಲಿಂದ ತೊಲಗು.',
    dotColor: 'bg-rose-500',
  },
  {
    id: 'hinglish_civil',
    langLabel: 'Hinglish',
    scenarioLabel: 'Harmless / Civil',
    langHint: 'hinglish',
    text: 'Yeh tutorial sach mein bahut accha aur helpful tha, great explanation.',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'hinglish_hostile',
    langLabel: 'Hinglish',
    scenarioLabel: 'Hostile / Harassment',
    langHint: 'hinglish',
    text: 'Tu ek number ka bekaar aur fraud aadmi hai, yahan se dafa ho ja.',
    dotColor: 'bg-rose-500',
  },
];

const LABEL_COLORS: Record<string, string> = {
  hate_speech: '#FF7675',
  harassment: '#FDCB6E',
  cyberbullying: '#6C5CE7',
  legitimate: '#00B894',
};

// ─── HELPER FORMATTER FOR PERCENTAGES (PREVENTS 0 FROM BECOMING '—') ─────────
function formatScorePct(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(score)) {
    return '0.0%';
  }
  return `${(score * 100).toFixed(1)}%`;
}

// ─── SCORE BAR COMPONENT ─────────────────────────────────────────────────────
function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const safeScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#858795] capitalize font-medium">{label.replace(/_/g, ' ')}</span>
        <span className="text-[#20212B] tabular-nums font-bold">{formatScorePct(safeScore)}</span>
      </div>
      <div className="h-1.5 bg-[#F0F1F5] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, safeScore * 100))}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── DETAILED EVALUATION RESPONSE CARD ───────────────────────────────────────
function EvaluationResponseCard({ result }: { result: AnalyzeResponse }) {
  const [showEvidence, setShowEvidence] = useState(false);

  const severityColors: Record<string, string> = {
    low: 'text-emerald-700 bg-emerald-50/80 border-emerald-200',
    medium: 'text-amber-700 bg-amber-50/80 border-amber-200',
    high: 'text-rose-700 bg-rose-50/80 border-rose-200',
    uncertain: 'text-[#858795] bg-[#F5F6FA] border-[#E9EAF1]',
  };

  const decisionBadges: Record<string, { bg: string; text: string; border: string; label: string }> = {
    no_action: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'No Action (Civil)' },
    flag_for_review: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Flag For Review' },
    human_review: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Human Verification' },
  };

  const tox = result.toxicity_prediction;
  const isToxic = tox?.is_toxic ?? false;
  const toxScore = tox?.toxicity_score ?? 0;
  const threshold = tox?.threshold ?? 0.40;
  const confidence = tox?.confidence ?? 0.50;

  return (
    <div className="bg-white rounded-2xl border border-[#E9EAF1] p-5 shadow-xs space-y-4">
      {/* Top Banner: Binary Model Verdict + Operational Severity + Decision */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pb-3 border-b border-[#E9EAF1]">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Binary Model Classification Verdict */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            isToxic
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isToxic ? <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isToxic ? 'Harmful / Toxic Content' : 'Civil / Non-Harmful Content'}</span>
          </span>

          {/* Operational Severity Badge */}
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize ${
            severityColors[result.severity] || severityColors.uncertain
          }`}>
            {result.severity} Severity
          </span>
        </div>

        {/* Operational Decision Badge */}
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
          decisionBadges[result.decision]?.bg || 'bg-slate-50'
        } ${decisionBadges[result.decision]?.text || 'text-slate-700'} ${
          decisionBadges[result.decision]?.border || 'border-slate-200'
        }`}>
          {decisionBadges[result.decision]?.label || result.decision.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Primary Model Metric: Calibrated Toxicity Score */}
      <div className="p-3.5 bg-[#FBFBFE] rounded-xl border border-[#DDD6FE] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#20212B]">
            <Sparkles className="w-3.5 h-3.5 text-[#6C5CE7]" />
            <span>Calibrated Toxicity Score (Offline Scikit-Learn):</span>
          </div>
          <span className={`text-base font-black tabular-nums ${isToxic ? 'text-rose-600' : 'text-emerald-600'}`}>
            {formatScorePct(toxScore)}
          </span>
        </div>
        <div className="h-2 bg-white rounded-full overflow-hidden border border-[#E9EAF1]">
          <div
            className={`h-full rounded-full transition-all duration-600 ${isToxic ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100, Math.max(0, toxScore * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#858795]">
          <span>Decision Cutoff Threshold: <strong className="text-[#20212B] font-mono">{(threshold * 100).toFixed(0)}%</strong></span>
          <span>Model Confidence: <strong className="text-[#6C5CE7] font-mono">{(confidence * 100).toFixed(1)}%</strong></span>
        </div>
      </div>

      {/* Operational Severity Reason */}
      {result.severity_reason && (
        <div className="text-xs text-[#858795] bg-[#F8F9FE] p-3 rounded-xl border border-[#E9EAF1]">
          <strong className="text-[#20212B]">Operational Policy Rationale: </strong>
          <span>{result.severity_reason}</span>
        </div>
      )}

      {/* Multi-Label Semantic Category Scores */}
      <div className="space-y-2 pt-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#858795]">
          Semantic Category Breakdown
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.labels.map(l => (
            <div key={l.label} className="p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1]">
              <ScoreBar label={l.label} score={l.score} color={LABEL_COLORS[l.label] || '#6C5CE7'} />
            </div>
          ))}
        </div>
      </div>

      {/* Metadata Strip: Detected Language, Latency, Model Checkpoint */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
        <div className="p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1]">
          <span className="text-[10px] text-[#858795] block uppercase font-semibold">Detected Script</span>
          <span className="font-bold text-[#20212B] capitalize mt-0.5 block truncate">
            {result.detected_language} {result.is_code_mixed ? '(Code-Mixed)' : ''}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1]">
          <span className="text-[10px] text-[#858795] block uppercase font-semibold">Model Pipeline</span>
          <span className="font-mono text-[11px] text-[#6C5CE7] font-bold mt-0.5 block truncate">
            {result.model_name}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1]">
          <span className="text-[10px] text-[#858795] block uppercase font-semibold">Inference Latency</span>
          <span className="font-bold text-[#20212B] tabular-nums mt-0.5 block">
            {result.processing_time_ms} ms
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1]">
          <span className="text-[10px] text-[#858795] block uppercase font-semibold">Model Status</span>
          <span className="font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Local Offline</span>
          </span>
        </div>
      </div>

      {/* Recommended Enforcement Action */}
      <div className="p-3 rounded-xl bg-[#EEEAFE]/50 border border-[#DDD6FE] text-xs">
        <strong className="text-[#6C5CE7]">Recommended Action: </strong>
        <span className="text-[#20212B]">{result.recommended_action}</span>
      </div>

      {/* Collapsible Evidence Tokens */}
      {result.labels.some(l => l.evidence.length > 0) && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="flex items-center gap-1.5 text-xs text-[#6C5CE7] hover:text-[#5B4BC4] font-semibold transition-colors cursor-pointer"
          >
            {showEvidence ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showEvidence ? 'Hide' : 'Inspect'} Detected Token Evidence ({result.labels.reduce((acc, l) => acc + l.evidence.length, 0)})</span>
          </button>
          {showEvidence && (
            <div className="mt-2 p-3 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-2 animate-in fade-in duration-200">
              {result.labels.filter(l => l.evidence.length > 0).map(l => (
                <div key={l.label}>
                  <span className="text-[10px] text-[#858795] uppercase font-mono">{l.label.replace(/_/g, ' ')} tokens:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {l.evidence.map((tok, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border border-[#DDD6FE] rounded text-[11px] text-[#6C5CE7] font-mono font-semibold">
                        "{tok}"
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MAIN CONTEXT INTELLIGENCE LAB COMPONENT ─────────────────────────────────
export default function ContextLab() {
  const { addToast } = useToast();
  const {
    mode,
    setMode,
    text,
    setText,
    languageHint,
    setLanguageHint,
    platform,
    setPlatform,
    sessions,
    activeSessionId,
    currentSession,
    loadingSession,
    newChat,
    selectSession,
    deleteSession,
    addMessageToActiveSession,
    compareText1,
    setCompareText1,
    compareText2,
    setCompareText2,
    compareLang1,
    setCompareLang1,
    compareLang2,
    setCompareLang2,
    compareResult,
    setCompareResult,
    clearCompare,
  } = useContextLab();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to latest message smoothly when new message arrives
  useEffect(() => {
    if (currentSession?.messages && currentSession.messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.messages?.length]);

  // Execute Single Comment Inference
  const executeAnalysis = async (commentText: string, langHint?: string, originPlat?: string) => {
    if (!commentText.trim()) {
      addToast('Please enter a comment to analyze.', 'warning');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await analyzeApi.analyze({
        text: commentText.trim(),
        language_hint: langHint || undefined,
        platform: originPlat || 'manual',
      });

      // Append to the active session conversation transcript
      await addMessageToActiveSession(commentText.trim(), langHint, originPlat || 'manual', resp.data);

      addToast('Comment analyzed and saved to current session.', 'success');
    } catch (err: any) {
      const msg = err.message || 'Analysis failed.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Click-to-Analyze for Sample Scenario Chips
  const handleSelectScenario = async (scenario: SampleScenario) => {
    setSelectedScenarioId(scenario.id);
    setText(scenario.text);
    setLanguageHint(scenario.langHint);
    await executeAnalysis(scenario.text, scenario.langHint, 'manual');
  };

  // Manual Submit button click
  const handleManualSubmit = async () => {
    setSelectedScenarioId(null);
    await executeAnalysis(text, languageHint, platform || 'manual');
  };

  // Clear single form
  const handleClearForm = () => {
    setText('');
    setLanguageHint('');
    setPlatform('');
    setSelectedScenarioId(null);
    setError(null);
  };

  // Start a fresh New Chat session
  const handleNewChat = async () => {
    try {
      await newChat();
      setSelectedScenarioId(null);
      setError(null);
      addToast('Started a new intelligence chat session.', 'info');
    } catch {
      addToast('Failed to initialize new session.', 'error');
    }
  };

  // Handle Two-Text Comparative Inference
  const handleCompareTexts = async () => {
    if (!compareText1.trim() || !compareText2.trim()) {
      addToast('Please enter both Input Text 1 and Input Text 2 to compare.', 'warning');
      return;
    }
    setLoading(true);
    setError(null);
    setCompareResult(null);
    try {
      const resp = await analyzeApi.compareTexts({
        text1: compareText1.trim(),
        text2: compareText2.trim(),
        language_hint1: compareLang1 || undefined,
        language_hint2: compareLang2 || undefined,
      });
      setCompareResult(resp.data);
      addToast('Comparative inference completed successfully.', 'success');
    } catch (err: any) {
      const msg = err.message || 'Comparative inference failed.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-screen-2xl page-enter pb-16">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] shadow-xs">
            <FlaskConical className="w-5 h-5 text-[#6C5CE7]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#20212B] tracking-tight">Context Intelligence Lab</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE]">
                Offline Inference
              </span>
            </div>
            <p className="text-xs text-[#858795] mt-0.5">
              Interactive session moderation, scenario benchmarking, and empirical two-text comparative evaluation.
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E9EAF1] shadow-xs">
          <button
            type="button"
            onClick={() => {
              setMode('single');
              setError(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'single'
                ? 'bg-[#6C5CE7] text-white shadow-xs'
                : 'text-[#858795] hover:text-[#20212B]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Single Analysis &amp; Chat</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('compare');
              setError(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'compare'
                ? 'bg-[#6C5CE7] text-white shadow-xs'
                : 'text-[#858795] hover:text-[#20212B]'
            }`}
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
            <span>Compare Context (Two Texts)</span>
          </button>
        </div>
      </div>

      {/* Global Error Notice */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          MODE 1: SINGLE ANALYSIS & CONVERSATIONAL INTELLIGENCE CHAT SESSION
          ═════════════════════════════════════════════════════════════════════════ */}
      {mode === 'single' && (
        <div className="space-y-6">
          {/* ── Active Session Bar with New Chat and History Selector ── */}
          <div className="bg-white p-4 rounded-2xl border border-[#E9EAF1] shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EEEAFE] flex items-center justify-center text-[#6C5CE7]">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#20212B]">
                    {currentSession?.title || 'Active Intelligence Session'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                    {currentSession?.messages?.length || 0} analyses
                  </span>
                </div>
                <div className="text-[11px] text-[#858795] flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[#858795]" />
                  <span>
                    Started {currentSession?.created_at ? new Date(currentSession.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Previous Sessions Dropdown */}
              {sessions.length > 0 && (
                <div className="relative">
                  <select
                    value={activeSessionId || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        selectSession(e.target.value);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] hover:bg-white text-xs text-[#20212B] font-medium transition-colors focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                  >
                    <option value="" disabled>Switch to previous session...</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.message_count} msgs)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* + New Chat Button */}
              <button
                type="button"
                onClick={handleNewChat}
                disabled={loading || loadingSession}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4BC4] text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            </div>
          </div>

          {/* ── Main Input Form with Embedded Sample Scenarios ── */}
          <div className="bg-white p-6 rounded-2xl border border-[#E9EAF1] shadow-xs space-y-4">
            {/* 1. Target Comment Text */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#20212B]">
                  Target Comment Text *
                </label>
                <span className="text-[10px] text-[#858795] font-mono">
                  {text.length} / 10,000 characters
                </span>
              </div>
              <textarea
                value={text}
                onChange={e => {
                  setText(e.target.value);
                  setSelectedScenarioId(null);
                }}
                rows={3}
                maxLength={10000}
                className="w-full px-4 py-3 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs md:text-sm text-[#20212B] placeholder-[#858795] focus:bg-white focus:outline-none focus:border-[#6C5CE7] transition-colors"
                placeholder="Type or paste any manual social comment to analyze, or click any sample scenario below..."
              />
            </div>

            {/* ── COMPACT SAMPLE SCENARIOS SECTION (BETWEEN TEXT & LANGUAGE HINT) ── */}
            <div className="space-y-2 pt-1 pb-1 border-y border-[#F0F1F5]">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#20212B]">
                  <Sparkles className="w-3.5 h-3.5 text-[#6C5CE7]" />
                  <span>Sample Scenarios (Click to test instantly):</span>
                </div>
                <span className="text-[10px] text-[#858795]">
                  Selects language &amp; automatically runs real inference
                </span>
              </div>

              {/* 12 Scenario Chips Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {SAMPLE_SCENARIOS.map(sc => {
                  const isSelected = selectedScenarioId === sc.id;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => handleSelectScenario(sc)}
                      disabled={loading}
                      title={sc.text}
                      className={`text-left p-2 rounded-xl border text-xs transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs hover:shadow-xs active:scale-98 disabled:opacity-60 ${
                        isSelected
                          ? 'bg-[#EEEAFE] border-[#6C5CE7] text-[#20212B] ring-1 ring-[#6C5CE7]'
                          : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#20212B] hover:bg-white hover:border-[#DDD6FE]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-[#6C5CE7] uppercase tracking-wide">
                          {sc.langLabel}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />
                      </div>
                      <span className="text-[11px] font-semibold text-[#20212B] truncate leading-tight">
                        {sc.scenarioLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Language Hint & Platform Origin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-[#858795] mb-1">
                  Language Hint (Optional Override)
                </label>
                <select
                  value={languageHint}
                  onChange={e => setLanguageHint(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                >
                  <option value="">Auto-Detect Script &amp; Language</option>
                  <optgroup label="Calibrated Local Model checkouts">
                    <option value="english">English (enhanced_word_char_v2)</option>
                    <option value="hindi">Hindi (hindi_word_char_v1)</option>
                    <option value="telugu">Telugu (telugu_generalization_v3)</option>
                    <option value="kannada">Kannada (kannada_word_char_v2)</option>
                    <option value="hinglish">Hinglish / Code-Mixed (hinglish_contextual_v2)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#858795] mb-1">
                  Platform Origin (Tagging)
                </label>
                <input
                  type="text"
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:bg-white focus:outline-none focus:border-[#6C5CE7] transition-colors"
                  placeholder="manual (or YouTube, Instagram, etc.)"
                  maxLength={50}
                />
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={loading || !text.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {loading ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Inference...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Analyze Comment</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClearForm}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F5F6FA] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#858795] hover:text-[#20212B] text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Form</span>
              </button>
            </div>
          </div>

          {/* ── Threaded Chat Transcript of Current Session ── */}
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#20212B]">
                <MessageSquare className="w-4 h-4 text-[#6C5CE7]" />
                <span>Session Conversation Transcript</span>
              </div>
              <span className="text-[11px] text-[#858795]">
                Analyses persist across tab navigation and browser sessions
              </span>
            </div>

            {/* Empty State when no analyses in session */}
            {(!currentSession?.messages || currentSession.messages.length === 0) && (
              <div className="bg-white p-8 rounded-2xl border border-dashed border-[#DDD6FE] text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center mx-auto shadow-xs">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-[#20212B]">No analyses in this session yet</h3>
                  <p className="text-xs text-[#858795] max-w-md mx-auto">
                    Type a custom message above and click <strong>Analyze Comment</strong>, or click any of the <strong>Sample Scenarios</strong> to test real multilingual model responses.
                  </p>
                </div>
              </div>
            )}

            {/* Conversation Feed */}
            {currentSession?.messages && currentSession.messages.map((msg, idx) => (
              <div key={msg.id || idx} className="space-y-3 page-enter">
                {/* User Input Bubble */}
                <div className="flex items-start gap-3 justify-end">
                  <div className="max-w-2xl bg-[#EEEAFE]/60 border border-[#DDD6FE] p-4 rounded-2xl rounded-tr-xs text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-4 text-[10px] text-[#858795]">
                      <span className="font-bold text-[#6C5CE7] flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>Submitted Comment #{idx + 1}</span>
                      </span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <p className="text-[#20212B] font-medium text-xs leading-relaxed whitespace-pre-wrap">
                      "{msg.text}"
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[#858795] pt-0.5">
                      {msg.language_hint && (
                        <span className="bg-white px-2 py-0.5 rounded border border-[#E9EAF1]">
                          Hint: {msg.language_hint}
                        </span>
                      )}
                      <span className="bg-white px-2 py-0.5 rounded border border-[#E9EAF1]">
                        Source: {msg.platform || 'manual'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Model Response Card */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#6C5CE7] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <EvaluationResponseCard result={msg.result} />
                  </div>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          MODE 2: REAL TWO-TEXT COMPARATIVE INFERENCE WORKSPACE
          ═════════════════════════════════════════════════════════════════════════ */}
      {mode === 'compare' && (
        <div className="space-y-6">
          {/* Two Inputs Panels Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Text 1 */}
            <div className="bg-white p-6 space-y-4 rounded-2xl border border-[#E9EAF1] shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#E9EAF1]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#20212B]">
                  <span className="w-5 h-5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center text-[11px] font-bold">1</span>
                  <span>Input Text 1 (Primary Message)</span>
                </div>
                <span className="text-[10px] text-[#858795] font-mono">{compareText1.length} / 10,000</span>
              </div>

              <div>
                <textarea
                  value={compareText1}
                  onChange={e => setCompareText1(e.target.value)}
                  rows={4}
                  maxLength={10000}
                  className="w-full px-4 py-3 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:bg-white focus:outline-none focus:border-[#6C5CE7] transition-colors"
                  placeholder="Enter the first comment or baseline text..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#858795] mb-1">
                  Language Hint 1 (Optional)
                </label>
                <select
                  value={compareLang1}
                  onChange={e => setCompareLang1(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                >
                  <option value="">Auto-Detect Script &amp; Language</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="telugu">Telugu</option>
                  <option value="kannada">Kannada</option>
                  <option value="hinglish">Hinglish / Code-Mixed</option>
                </select>
              </div>
            </div>

            {/* Input Text 2 */}
            <div className="bg-white p-6 space-y-4 rounded-2xl border border-[#E9EAF1] shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#E9EAF1]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#20212B]">
                  <span className="w-5 h-5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center text-[11px] font-bold">2</span>
                  <span>Input Text 2 (Comparison / Variant Message)</span>
                </div>
                <span className="text-[10px] text-[#858795] font-mono">{compareText2.length} / 10,000</span>
              </div>

              <div>
                <textarea
                  value={compareText2}
                  onChange={e => setCompareText2(e.target.value)}
                  rows={4}
                  maxLength={10000}
                  className="w-full px-4 py-3 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:bg-white focus:outline-none focus:border-[#6C5CE7] transition-colors"
                  placeholder="Enter the second comment or variant text..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#858795] mb-1">
                  Language Hint 2 (Optional)
                </label>
                <select
                  value={compareLang2}
                  onChange={e => setCompareLang2(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                >
                  <option value="">Auto-Detect Script &amp; Language</option>
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="telugu">Telugu</option>
                  <option value="kannada">Kannada</option>
                  <option value="hinglish">Hinglish / Code-Mixed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCompareTexts}
              disabled={loading || !compareText1.trim() || !compareText2.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Independent Inferences...</span>
                </>
              ) : (
                <>
                  <Scale className="w-3.5 h-3.5" />
                  <span>Compare &amp; Analyze</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={clearCompare}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F5F6FA] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#858795] hover:text-[#20212B] text-xs font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {/* ── COMPARATIVE RESULTS VIEW (PROMINENT AT TOP) ── */}
          {compareResult && (
            <div className="space-y-6 page-enter">
              {/* SIDE-BY-SIDE SUMMARY PREDICTION CARDS (TEXT 1 vs TEXT 2) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Text 1 Card */}
                <div className="bg-white p-5 rounded-2xl border border-[#E9EAF1] shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E9EAF1]">
                    <div className="flex items-center gap-2 font-bold text-xs text-[#20212B]">
                      <span className="w-5 h-5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center text-[10px]">1</span>
                      <span>Text 1 Prediction Result</span>
                    </div>
                    <span className="text-[10px] text-[#858795] capitalize">{compareResult.text1_analysis.detected_language}</span>
                  </div>
                  <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1] text-xs font-medium text-[#20212B] italic">
                    "{compareResult.text1_analysis.original_text}"
                  </div>
                  <EvaluationResponseCard result={compareResult.text1_analysis} />
                </div>

                {/* Text 2 Card */}
                <div className="bg-white p-5 rounded-2xl border border-[#DDD6FE] shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E9EAF1]">
                    <div className="flex items-center gap-2 font-bold text-xs text-[#20212B]">
                      <span className="w-5 h-5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center text-[10px]">2</span>
                      <span>Text 2 Prediction Result</span>
                    </div>
                    <span className="text-[10px] text-[#858795] capitalize">{compareResult.text2_analysis.detected_language}</span>
                  </div>
                  <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1] text-xs font-medium text-[#20212B] italic">
                    "{compareResult.text2_analysis.original_text}"
                  </div>
                  <EvaluationResponseCard result={compareResult.text2_analysis} />
                </div>
              </div>

              {/* Relative Harm Synthesis Card */}
              <div className="bg-white p-6 rounded-2xl border border-[#DDD6FE] shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#E9EAF1]">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-[#6C5CE7]" />
                    <h3 className="text-sm font-bold text-[#20212B]">
                      Comparative Synthesis &amp; Relative Harm Assessment
                    </h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    compareResult.predictions_differ
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {compareResult.predictions_differ ? 'Predictions Differ' : 'Predictions Concordant'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#EEEAFE]/50 border border-[#DDD6FE] text-xs text-[#20212B] space-y-1.5">
                  <div className="font-bold text-[#6C5CE7] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Relative Harm Assessment:</span>
                  </div>
                  <p className="text-xs leading-relaxed font-medium">
                    {compareResult.relative_harm_assessment}
                  </p>
                  <p className="text-[11px] text-[#858795] pt-1">
                    {compareResult.comparability_notice}
                  </p>
                </div>

                {/* Score Differences Table (Toxicity First, then Categories) */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#858795] uppercase tracking-wider">
                    Score Variations Breakdown (Input 2 vs Input 1)
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[#E9EAF1]">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3.5">Metric / Category</th>
                          <th className="py-2.5 px-3">Input Text 1</th>
                          <th className="py-2.5 px-3">Input Text 2</th>
                          <th className="py-2.5 px-3">Variation (Δ)</th>
                          <th className="py-2.5 px-4">Relative Interpretation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F1F5]">
                        {/* 1. Primary Row: Calibrated Toxicity Score */}
                        {(() => {
                          const tDiff = compareResult.toxicity_difference || compareResult.score_differences?.toxicity;
                          const t1 = tDiff?.text1 ?? (compareResult.text1_analysis.toxicity_prediction?.toxicity_score || 0);
                          const t2 = tDiff?.text2 ?? (compareResult.text2_analysis.toxicity_prediction?.toxicity_score || 0);
                          const delta = tDiff?.diff ?? (t2 - t1);
                          return (
                            <tr className="bg-[#FBFBFE] font-medium hover:bg-[#EEEAFE]/30 transition-colors">
                              <td className="py-3 px-3.5 font-bold text-[#6C5CE7] flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#6C5CE7]" />
                                <span>Overall Toxicity Probability</span>
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums text-[#20212B] font-bold">
                                {formatScorePct(t1)}
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums text-[#20212B] font-bold">
                                {formatScorePct(t2)}
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                  Math.abs(delta) < 0.01
                                    ? 'bg-[#F5F6FA] text-[#858795]'
                                    : delta > 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[11px] text-[#858795]">
                                {Math.abs(delta) < 0.01
                                  ? 'Equivalent toxicity scores'
                                  : delta > 0
                                  ? 'Elevated toxicity detected in Text 2'
                                  : 'Elevated toxicity detected in Text 1'}
                              </td>
                            </tr>
                          );
                        })()}

                        {/* 2. Semantic Category Rows */}
                        {['hate_speech', 'harassment', 'cyberbullying', 'legitimate'].map((label) => {
                          const item = compareResult.score_differences[label] || {
                            text1: compareResult.text1_analysis.labels.find(l => l.label === label)?.score || 0,
                            text2: compareResult.text2_analysis.labels.find(l => l.label === label)?.score || 0,
                            diff: (compareResult.text2_analysis.labels.find(l => l.label === label)?.score || 0) -
                                  (compareResult.text1_analysis.labels.find(l => l.label === label)?.score || 0),
                          };
                          const delta = item.diff;
                          const isHarm = label !== 'legitimate';

                          return (
                            <tr key={label} className="hover:bg-[#F8F9FE] transition-colors">
                              <td className="py-3 px-3.5 font-bold text-[#20212B] capitalize">
                                {label.replace(/_/g, ' ')}
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums text-[#858795]">
                                {formatScorePct(item.text1)}
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums font-semibold text-[#20212B]">
                                {formatScorePct(item.text2)}
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                  Math.abs(delta) < 0.005
                                    ? 'bg-[#F5F6FA] text-[#858795]'
                                    : delta > 0
                                    ? isHarm ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                    : isHarm ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                  {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[11px] text-[#858795]">
                                {Math.abs(delta) < 0.005
                                  ? 'Equally scored between both inputs'
                                  : delta > 0
                                  ? isHarm ? 'Higher indicator in Text 2' : 'Higher civility indicator in Text 2'
                                  : isHarm ? 'Higher indicator in Text 1' : 'Higher civility indicator in Text 1'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Limitations & Calibration Notice */}
                {compareResult.limitations && compareResult.limitations.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Model Calibration &amp; Cross-Lingual Limitations:</span>
                    </div>
                    {compareResult.limitations.map((lim, idx) => (
                      <p key={idx} className="text-[11px] leading-relaxed">
                        • {lim}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
