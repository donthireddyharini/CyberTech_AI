import { useState } from 'react';
import {
  FlaskConical, Send, RotateCcw, AlertCircle, CheckCircle,
  Info, ArrowRight, Clock, Globe, ChevronDown, ChevronUp,
  Layers, SplitSquareHorizontal
} from 'lucide-react';
import { analyzeApi } from '../api/client';
import type { AnalyzeResponse, CompareContextResponse } from '../types';
import { useToast } from '../App';

const SAMPLE_EXAMPLES = [
  {
    label: "English: Legitimate Disagreement (Civil)",
    text: "I disagree with your opinion, and here is why — the data doesn't support your conclusion.",
    context_before: "",
    expected: "legitimate / no_action",
  },
  {
    label: "English: Targeted Harassment",
    text: "You should just shut up, nobody wants to hear from you.",
    context_before: "",
    expected: "harassment / flag_for_review",
  },
  {
    label: "Hindi: Harmless News / Civil",
    text: "सरकार हमेशा से किसानों की कमाई को बढ़ाने के लिए काम करती है।",
    context_before: "",
    expected: "legitimate / no_action",
  },
  {
    label: "Hindi: Hostile / Hate Speech",
    text: "मेरे देश के हिन्दु बहुत निराले है। कुछ तो पक्के राम भक्त है और कुछ बाबर के साले है",
    context_before: "",
    expected: "hostile / flag_for_review",
  },
  {
    label: "Telugu: Harmless Sports Update",
    text: "చివర్లో జోఫ్రా ఆర్చర్‌ భారీగా షాట్లు కొట్టి జట్టును విజయతీరాలు చేర్చాడు.",
    context_before: "",
    expected: "legitimate / no_action",
  },
  {
    label: "Telugu: Hate Speech Violation",
    text: "ట్విటర్‌లో విమర్శల వర్షం కురిపించారు.",
    context_before: "",
    expected: "hate_speech / flag_for_review",
  },
  {
    label: "Hinglish: Harmless Chat",
    text: "bhai ye picture dekhne chale kya kal shaam ko",
    context_before: "",
    expected: "legitimate / no_action",
  },
  {
    label: "Hinglish: Abusive Profanity",
    text: "tere baap ko bol saale kutte madarchod",
    context_before: "",
    expected: "hate_speech / flag_for_review",
  },
  {
    label: "Kannada: Harmless Compliment",
    text: "ನಿಮ್ಮ ಕೆಲಸ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ, ಧನ್ಯವಾದಗಳು.",
    context_before: "",
    expected: "legitimate / no_action",
  },
  {
    label: "Kannada: Offensive Insult",
    text: "ಹೋಗೋ ಬೋಳಿಮಗನೆ ಸುಳೆಮಗನೆ",
    context_before: "",
    expected: "offensive / flag_for_review",
  },
];

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label.replace(/_/g, ' ')}</span>
        <span className="text-slate-300 font-mono">{(score * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

const LABEL_COLORS: Record<string, string> = {
  hate_speech: '#f43f5e',
  harassment: '#f97316',
  cyberbullying: '#8b5cf6',
  legitimate: '#10b981',
};

function ResultPanel({ result, title }: { result: AnalyzeResponse; title?: string }) {
  const [showEvidence, setShowEvidence] = useState(false);

  const severityColors: Record<string, string> = {
    low: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/40',
    medium: 'text-amber-400 bg-amber-900/20 border-amber-700/40',
    high: 'text-red-400 bg-red-900/20 border-red-700/40',
    uncertain: 'text-slate-400 bg-slate-800 border-slate-700/40',
  };

  const decisionColors: Record<string, string> = {
    no_action: 'text-emerald-400',
    flag_for_review: 'text-red-400',
    human_review: 'text-amber-400',
  };

  return (
    <div className="space-y-4">
      {title && <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h4>}

      {/* Decision Banner */}
      <div className={`rounded-lg p-3 border ${severityColors[result.severity] || severityColors.uncertain}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-semibold text-sm capitalize">{result.severity} Severity</div>
            <div className="text-xs opacity-80 mt-0.5">{result.severity_reason}</div>
          </div>
          <div className={`text-sm font-bold ${decisionColors[result.decision] || 'text-slate-400'}`}>
            {result.decision.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Ambiguity Warning */}
      {result.ambiguity_warning && (
        <div className="flex gap-2 p-3 rounded-lg bg-amber-900/10 border border-amber-700/30">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">{result.ambiguity_warning}</p>
        </div>
      )}

      {/* Unified Language Route Card */}
      {result.language_route && (
        <div className={`p-3 rounded-xl border text-xs space-y-2 ${
          result.language_route.status === 'validated_model'
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
            : result.language_route.status === 'needs_review'
            ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
            : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                result.language_route.status === 'validated_model' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`} />
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Language Route: {result.language_route.target_language}
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              result.language_route.status === 'validated_model'
                ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50'
                : result.language_route.status === 'needs_review'
                ? 'bg-amber-900/50 text-amber-300 border-amber-700/50'
                : 'bg-rose-900/50 text-rose-300 border-rose-700/50'
            }`}>
              {result.language_route.status === 'validated_model' ? 'VALIDATED MODEL' : result.language_route.status === 'needs_review' ? 'NEEDS REVIEW' : 'UNSUPPORTED'}
            </span>
          </div>

          <div className="text-[11px] opacity-90 leading-relaxed">
            {result.language_route.notice}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-700/30 text-[10px] text-slate-400">
            <span>Model: <code className="text-slate-300">{result.language_route.model_name}</code></span>
            <span>Policy: <span className="font-medium capitalize text-slate-300">{result.language_route.review_status.replace(/_/g, ' ')}</span></span>
          </div>
        </div>
      )}

      {/* Machine Learning Model Prediction Card (Local Scikit-Learn Pipeline) */}
      {result.toxicity_prediction && result.toxicity_prediction.model_available ? (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-purple-200">
                Trained {result.detected_language ? (result.detected_language.charAt(0).toUpperCase() + result.detected_language.slice(1)) : 'Multilingual'} Model ({result.toxicity_prediction.model_version})
              </span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              result.toxicity_prediction.is_toxic
                ? 'bg-red-950/60 text-red-400 border-red-700/50'
                : 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50'
            }`}>
              {result.toxicity_prediction.is_toxic ? 'TOXIC / HARMFUL' : 'NON-TOXIC / CIVIL'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Prediction Probability</span>
              <span className="font-mono font-semibold text-white">
                {(result.toxicity_prediction.toxicity_score * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-navy-800 rounded-full h-2 overflow-hidden border border-indigo-950">
              <div
                className={`h-full transition-all duration-300 ${
                  result.toxicity_prediction.is_toxic ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, result.toxicity_prediction.toxicity_score * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Threshold: {(result.toxicity_prediction.threshold * 100).toFixed(0)}%</span>
              <span>Model Confidence: {(result.toxicity_prediction.confidence * 100).toFixed(1)}%</span>
            </div>
          </div>

          <p className="text-[10px] text-purple-300/80 leading-relaxed bg-purple-900/20 p-2 rounded border border-purple-800/30">
            ℹ️ {result.toxicity_prediction.scope_notice}
          </p>
        </div>
      ) : result.toxicity_prediction && (
        <div className="p-3 rounded-lg bg-navy-900/40 border border-slate-700/40 text-[11px] text-slate-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-300">Model Pending:</span> {result.toxicity_prediction.scope_notice}
          </div>
        </div>
      )}

      {/* Label Scores */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Classification Scores</div>
        <p className="text-[11px] text-slate-600">
          ⚠ These are pattern-match scores, NOT calibrated probabilities. Not equivalent to confidence.
        </p>
        {result.labels.map(label => (
          <ScoreBar
            key={label.label}
            label={label.label}
            score={label.score}
            color={LABEL_COLORS[label.label] || '#6366f1'}
          />
        ))}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-navy-900/50 rounded-lg p-2.5">
          <div className="text-slate-500 mb-1">Detected Language</div>
          <div className="text-slate-200 font-medium capitalize">{result.detected_language}</div>
          {result.is_code_mixed && <div className="text-purple-400 text-[10px]">Code-mixed</div>}
        </div>
        <div className="bg-navy-900/50 rounded-lg p-2.5">
          <div className="text-slate-500 mb-1">Confidence Level</div>
          <div className="text-slate-200 font-medium capitalize">{result.confidence_level}</div>
          <div className="text-slate-600 text-[10px]">Pattern match strength</div>
        </div>
        <div className="bg-navy-900/50 rounded-lg p-2.5">
          <div className="text-slate-500 mb-1">Processing Time</div>
          <div className="text-slate-200 font-medium">{result.processing_time_ms}ms</div>
        </div>
        <div className="bg-navy-900/50 rounded-lg p-2.5">
          <div className="text-slate-500 mb-1">Model</div>
          <div className="text-slate-200 font-medium">{result.model_name} v{result.model_version}</div>
        </div>
      </div>

      {/* Recommended Action */}
      <div className="p-3 rounded-lg bg-indigo-900/10 border border-indigo-700/30">
        <div className="text-xs font-semibold text-indigo-300 mb-1">Recommended Action</div>
        <p className="text-xs text-slate-300">{result.recommended_action}</p>
      </div>

      {/* Evidence */}
      {result.labels.some(l => l.evidence.length > 0) && (
        <div>
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            {showEvidence ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showEvidence ? 'Hide' : 'Show'} matched patterns
          </button>
          {showEvidence && (
            <div className="mt-2 space-y-1">
              {result.labels.filter(l => l.evidence.length > 0).map(l => (
                <div key={l.label}>
                  <div className="text-[10px] text-slate-500 capitalize">{l.label.replace(/_/g, ' ')} patterns:</div>
                  {l.evidence.map((e, i) => (
                    <span key={i} className="inline-block mr-1 mt-0.5 px-2 py-0.5 bg-navy-700 rounded text-[10px] text-slate-400">
                      "{e}"
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model type note */}
      <div className="text-[10px] text-slate-600 border-t border-indigo-900/20 pt-2 mt-2">
        {result.model_type_note}
      </div>
    </div>
  );
}

export default function ContextLab() {
  const [text, setText] = useState('');
  const [contextBefore, setContextBefore] = useState('');
  const [contextAfter, setContextAfter] = useState('');
  const [languageHint, setLanguageHint] = useState('');
  const [platform, setPlatform] = useState('');
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [compareResult, setCompareResult] = useState<CompareContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleAnalyze = async () => {
    if (!text.trim()) {
      addToast('Please enter some text to analyze.', 'warning');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setCompareResult(null);
    try {
      if (mode === 'compare') {
        const resp = await analyzeApi.compareContext({
          text,
          context_before: contextBefore || undefined,
          context_after: contextAfter || undefined,
        });
        setCompareResult(resp.data);
      } else {
        const resp = await analyzeApi.analyze({
          text,
          context_before: contextBefore || undefined,
          context_after: contextAfter || undefined,
          language_hint: languageHint || undefined,
          platform: platform || undefined,
        });
        setResult(resp.data);
      }
    } catch (err: any) {
      setError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setText('');
    setContextBefore('');
    setContextAfter('');
    setLanguageHint('');
    setPlatform('');
    setResult(null);
    setCompareResult(null);
    setError(null);
  };

  const loadExample = (ex: typeof SAMPLE_EXAMPLES[0]) => {
    setText(ex.text);
    setContextBefore(ex.context_before);
    setResult(null);
    setCompareResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-glow-purple">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Context Intelligence Lab</h1>
          <p className="text-sm text-slate-400">Analyze how context affects content moderation decisions. Key differentiator of Sentinel AI.</p>
        </div>
        {/* Mode Toggle */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setMode('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'single' ? 'bg-indigo-600 text-white' : 'btn-secondary'}`}
          >
            <Layers className="w-3 h-3" /> Single Analysis
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'compare' ? 'bg-indigo-600 text-white' : 'btn-secondary'}`}
          >
            <SplitSquareHorizontal className="w-3 h-3" /> Compare Context
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="xl:col-span-2 space-y-4">
          <div className="card-glow p-5 space-y-4">
            <div>
              <label className="label">Comment Text *</label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={4}
                maxLength={10000}
                className="input-field resize-y"
                placeholder="Enter the comment or message to analyze..."
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-600">Max 10,000 characters</span>
                <span className="text-[10px] text-slate-600">{text.length}/10000</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Previous Message (Context Before)</label>
                <textarea
                  value={contextBefore}
                  onChange={e => setContextBefore(e.target.value)}
                  rows={2}
                  className="input-field resize-none text-sm"
                  placeholder="What was said before this comment?"
                />
              </div>
              <div>
                <label className="label">Reply / Context After</label>
                <textarea
                  value={contextAfter}
                  onChange={e => setContextAfter(e.target.value)}
                  rows={2}
                  className="input-field resize-none text-sm"
                  placeholder="What came after this comment?"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Language (optional)</label>
                <select value={languageHint} onChange={e => setLanguageHint(e.target.value)} className="select-field">
                  <option value="">Auto-detect Script &amp; Language</option>
                  <optgroup label="Operational Production Model">
                    <option value="english">English (Validated Model Active)</option>
                  </optgroup>
                  <optgroup label="Priority Indic Candidates (GPU Evaluation Suite)">
                    <option value="hindi">Hindi (MuRIL Candidate)</option>
                    <option value="code_mixed">Hinglish / Code-Mixed (HinTox Candidate)</option>
                    <option value="telugu">Telugu (IndicBERT Candidate)</option>
                    <option value="bengali">Bengali (MuRIL Candidate)</option>
                    <option value="marathi">Marathi (HASOC Candidate)</option>
                    <option value="tamil">Tamil (IndicBERT Candidate)</option>
                    <option value="malayalam">Malayalam (IndicBERT Candidate)</option>
                    <option value="urdu">Urdu (MuRIL Candidate)</option>
                    <option value="gujarati">Gujarati (Candidate)</option>
                  </optgroup>
                  <optgroup label="Scheduled Indian Languages (Human-Review-Only)">
                    <option value="kannada">Kannada (Review Only)</option>
                    <option value="assamese">Assamese (Review Only)</option>
                    <option value="bodo">Bodo (Review Only)</option>
                    <option value="dogri">Dogri (Review Only)</option>
                    <option value="kashmiri">Kashmiri (Review Only)</option>
                    <option value="konkani">Konkani (Review Only)</option>
                    <option value="maithili">Maithili (Review Only)</option>
                    <option value="manipuri">Manipuri / Meitei (Review Only)</option>
                    <option value="nepali">Nepali (Review Only)</option>
                    <option value="odia">Odia (Review Only)</option>
                    <option value="punjabi">Punjabi (Review Only)</option>
                    <option value="sanskrit">Sanskrit (Review Only)</option>
                    <option value="santali">Santali (Review Only)</option>
                    <option value="sindhi">Sindhi (Review Only)</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="label">Platform (optional)</label>
                <input
                  type="text"
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  className="input-field"
                  placeholder="Twitter, YouTube, etc."
                  maxLength={100}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleAnalyze}
                disabled={loading || !text.trim()}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> {mode === 'compare' ? 'Compare Context' : 'Analyze'}</>
                )}
              </button>
              <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="card-glow p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Analysis Result
              </h3>
              <ResultPanel result={result} />
            </div>
          )}

          {compareResult && (
            <div className="card-glow p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <SplitSquareHorizontal className="w-4 h-4 text-indigo-400" />
                Context Comparison Results
              </h3>
              <div className="p-3 rounded-lg bg-blue-900/10 border border-blue-700/30 text-xs text-blue-300">
                <Info className="w-3.5 h-3.5 inline mr-1" />
                {compareResult.note}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`badge ${compareResult.severity_changed ? 'bg-amber-900/30 text-amber-400 border-amber-700/40' : 'bg-navy-700 text-slate-400 border-slate-700/40'}`}>
                  Severity {compareResult.severity_changed ? 'CHANGED' : 'unchanged'}
                </span>
                <span className={`badge ${compareResult.decision_changed ? 'bg-amber-900/30 text-amber-400 border-amber-700/40' : 'bg-navy-700 text-slate-400 border-slate-700/40'}`}>
                  Decision {compareResult.decision_changed ? 'CHANGED' : 'unchanged'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-navy-900/50 border border-indigo-900/30">
                  <ResultPanel result={compareResult.without_context} title="Without Context" />
                </div>
                <div className="p-4 rounded-xl bg-navy-900/50 border border-purple-800/30">
                  <ResultPanel result={compareResult.with_context} title="With Context" />
                </div>
              </div>
              {/* Label Changes */}
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Score Changes</div>
                <div className="space-y-2">
                  {Object.entries(compareResult.label_changes).map(([label, change]) => (
                    <div key={label} className="flex items-center gap-3 text-xs">
                      <span className="w-28 text-slate-400 capitalize">{label.replace(/_/g, ' ')}</span>
                      <span className="text-slate-500">{(change.without_context * 100).toFixed(1)}%</span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span className="text-slate-300">{(change.with_context * 100).toFixed(1)}%</span>
                      <span className={`font-medium ${change.delta > 0.01 ? 'text-red-400' : change.delta < -0.01 ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {change.delta > 0 ? '+' : ''}{(change.delta * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Examples Sidebar */}
        <div className="space-y-4">
          <div className="card-glow p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              Sample Scenarios
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Click any example to load it. Results come from the actual inference pipeline.
            </p>
            <div className="space-y-2">
              {SAMPLE_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => loadExample(ex)}
                  className="w-full text-left p-3 rounded-lg bg-navy-900/50 border border-indigo-900/30 hover:border-indigo-600/50 transition-all"
                >
                  <div className="text-xs font-medium text-slate-300 mb-1">{ex.label}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-2">{ex.text}</div>
                  <div className="text-[10px] text-indigo-500 mt-1">Expected: {ex.expected}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h4 className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Important Notes
            </h4>
            <ul className="text-[11px] text-slate-500 space-y-1.5">
              <li>• Classification scores are pattern-match results, NOT calibrated probabilities.</li>
              <li>• Context may shift scores but does not guarantee correct intent interpretation.</li>
              <li>• Human review is always recommended for ambiguous cases.</li>
              <li>• The current model is a rule-based baseline, NOT a fine-tuned transformer.</li>
              <li>• Results are stored in the database for the moderation workflow.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
