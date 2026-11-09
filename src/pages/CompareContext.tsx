import { useState, useEffect } from 'react';
import {
  SplitSquareHorizontal, ArrowRight, RotateCcw,
  Sparkles, ShieldAlert, CheckCircle2, AlertTriangle,
  Scale, TrendingUp, TrendingDown, Clock, Check,
  Layers, Info, Trash2, ArrowLeftRight
} from 'lucide-react';
import { analyzeApi } from '../api/client';
import type { CompareTextsResponse, ScoreDiffItem } from '../types';
import { useToast } from '../App';
import { useContextLab } from '../context/ContextLabContext';
import { useAuth } from '../context/AuthContext';

interface SavedComparisonItem {
  id: string;
  timestamp: string;
  text1: string;
  text2: string;
  lang1?: string;
  lang2?: string;
  result: CompareTextsResponse;
}

const DEFAULT_HISTORY_ITEMS: SavedComparisonItem[] = [
  {
    id: 'comp_demo_1',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    text1: 'I strongly disagree with your political opinion on this policy.',
    text2: 'You are an absolute clown who should be driven out of this country.',
    lang1: 'english',
    lang2: 'english',
    result: {
      text1_analysis: {
        id: 'rec_base_1',
        text: 'I strongly disagree with your political opinion on this policy.',
        original_text: 'I strongly disagree with your political opinion on this policy.',
        labels: [
          { label: 'legitimate', score: 0.94, evidence: ['strongly disagree'] },
          { label: 'harassment', score: 0.05, evidence: [] },
          { label: 'hate_speech', score: 0.01, evidence: [] },
          { label: 'cyberbullying', score: 0.01, evidence: [] }
        ],
        severity: 'low',
        severity_reason: 'Legitimate disagreement without abusive language',
        decision: 'no_action',
        confidence_level: 'high',
        detected_language: 'english',
        is_code_mixed: false,
        model_name: 'sentinel_english_baseline',
        model_version: 'enhanced_word_char_v2',
        inference_timestamp: Date.now() / 1000,
        processing_time_ms: 1.8,
        ambiguity_warning: null,
        recommended_action: 'None (Approved)',
        model_type_note: 'Standard',
        toxicity_prediction: {
          is_toxic: false,
          toxicity_score: 0.06,
          confidence: 0.94,
          threshold: 0.40,
          model_version: 'enhanced_word_char_v2',
          model_available: true,
          scope_notice: 'calibrated'
        }
      },
      text2_analysis: {
        id: 'rec_target_1',
        text: 'You are an absolute clown who should be driven out of this country.',
        original_text: 'You are an absolute clown who should be driven out of this country.',
        labels: [
          { label: 'harassment', score: 0.88, evidence: ['absolute clown'] },
          { label: 'hate_speech', score: 0.76, evidence: ['driven out of this country'] },
          { label: 'cyberbullying', score: 0.65, evidence: ['absolute clown'] },
          { label: 'legitimate', score: 0.02, evidence: [] }
        ],
        severity: 'high',
        severity_reason: 'Targeted hostility with exclusionist derogatory abuse',
        decision: 'flag_for_review',
        confidence_level: 'high',
        detected_language: 'english',
        is_code_mixed: false,
        model_name: 'sentinel_english_baseline',
        model_version: 'enhanced_word_char_v2',
        inference_timestamp: Date.now() / 1000,
        processing_time_ms: 2.1,
        ambiguity_warning: null,
        recommended_action: 'Hide Comment / Flag Review',
        model_type_note: 'Standard',
        toxicity_prediction: {
          is_toxic: true,
          toxicity_score: 0.89,
          confidence: 0.89,
          threshold: 0.40,
          model_version: 'enhanced_word_char_v2',
          model_available: true,
          scope_notice: 'calibrated'
        }
      },
      predictions_differ: true,
      score_differences: {
        hate_speech: { text1: 0.01, text2: 0.76, diff: 0.75 },
        harassment: { text1: 0.05, text2: 0.88, diff: 0.83 },
        cyberbullying: { text1: 0.01, text2: 0.65, diff: 0.64 },
        legitimate: { text1: 0.94, text2: 0.02, diff: -0.92 }
      },
      toxicity_difference: { text1: 0.06, text2: 0.89, diff: 0.83 },
      relative_harm_assessment: 'Text 2 exhibits a significant escalation into targeted hostility (+83% toxicity score delta) with direct exclusionist phrasing.',
      comparability_notice: 'Direct cross-lingual semantic comparability verified across model representations.',
      limitations: ['Calibrated regional word and character n-gram scoring']
    }
  }
];

export default function CompareContext() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const storageKeyHistory = `cybertech_comparison_history_${user?.id || 'guest'}`;
  const {
    compareText1, setCompareText1,
    compareText2, setCompareText2,
    compareLang1, setCompareLang1,
    compareLang2, setCompareLang2,
    compareResult, setCompareResult,
    clearCompare
  } = useContextLab();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedComparisonItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKeyHistory);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_HISTORY_ITEMS;
  });

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyHistory, JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  // Execute Comparison
  const handleCompare = async () => {
    if (loading) return;
    if (!compareText1.trim() || !compareText2.trim()) {
      addToast('Please enter text into both Input Text 1 and Input Text 2.', 'warning');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await analyzeApi.compareTexts({
        text1: compareText1.trim(),
        text2: compareText2.trim(),
        language_hint1: compareLang1 || undefined,
        language_hint2: compareLang2 || undefined,
      });

      const resData = resp.data;
      setCompareResult(resData);

      // Prepend to persistent history
      const newHistoryItem: SavedComparisonItem = {
        id: `comp_${Date.now()}`,
        timestamp: new Date().toISOString(),
        text1: compareText1.trim(),
        text2: compareText2.trim(),
        lang1: compareLang1,
        lang2: compareLang2,
        result: resData
      };

      setHistory(prev => [newHistoryItem, ...prev.filter(h => h.text1 !== newHistoryItem.text1 || h.text2 !== newHistoryItem.text2)].slice(0, 20));
      addToast('Comparison completed and saved to history.', 'success');
    } catch (err: any) {
      const msg = err.message || 'Comparison failed.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Restore past comparison from history
  const handleRestore = (item: SavedComparisonItem) => {
    setCompareText1(item.text1);
    setCompareText2(item.text2);
    if (item.lang1) setCompareLang1(item.lang1);
    if (item.lang2) setCompareLang2(item.lang2);
    setCompareResult(item.result);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    addToast('Restored previous comparison into active workspace.', 'info');
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKeyHistory);
    } catch {
      // Ignore
    }
    addToast('Comparison history cleared.', 'info');
  };

  return (
    <div className="space-y-6 page-enter pb-12">
      {/* ── Page Header ── */}
      <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6C5CE7] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6C5CE7] bg-[#EEEAFE] px-2.5 py-0.5 rounded-full border border-[#DDD6FE]">
              Comparative Counterfactual NLP
            </span>
          </div>
          <h1 className="text-xl font-black text-[#20212B] tracking-tight mt-1.5 flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-[#6C5CE7]" />
            <span>Compare Context &amp; Counterfactual Analysis</span>
          </h1>
          <p className="text-xs text-[#858795] mt-1 max-w-3xl leading-relaxed">
            Side-by-side comparative analysis of two texts to evaluate nuance, sentiment shifts, lexical modifications, and relative severity across regional languages.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            clearCompare();
            addToast('Comparison workspace reset.', 'info');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] hover:bg-[#F0F1F5] text-[#858795] hover:text-[#20212B] text-xs font-semibold transition-all shadow-xs cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Inputs</span>
        </button>
      </div>

      {/* ── Two Input Panels (Side-by-Side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Input Text 1 */}
        <div className="bg-white rounded-2xl border border-[#E9EAF1] p-5 shadow-xs space-y-3 relative">
          <div className="flex items-center justify-between border-b border-[#E9EAF1] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#20212B]">
                Input Text 1 (Baseline Context)
              </h2>
            </div>
            <select
              value={compareLang1}
              onChange={(e) => setCompareLang1(e.target.value)}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E9EAF1] bg-[#F8F9FE] text-[#20212B] font-medium focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">Auto-Detect Language</option>
              <option value="english">English</option>
              <option value="hindi">Hindi (हिन्दी)</option>
              <option value="telugu">Telugu (తెలుగు)</option>
              <option value="kannada">Kannada (ಕನ್ನಡ)</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          <textarea
            value={compareText1}
            onChange={(e) => setCompareText1(e.target.value)}
            rows={5}
            placeholder="Enter baseline comment text..."
            className="w-full p-3.5 rounded-xl border border-[#E9EAF1] bg-[#FBFBFE] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7] focus:bg-white transition-all resize-y"
          />

          <div className="flex items-center justify-between text-[11px] text-[#858795] pt-1">
            <span>{compareText1.length} characters</span>
            <button
              type="button"
              onClick={() => setCompareText1('I do not agree with your interpretation, here is a factual counterpoint.')}
              className="text-[#6C5CE7] hover:underline font-semibold cursor-pointer"
            >
              Fill Sample Baseline
            </button>
          </div>
        </div>

        {/* Panel 2: Input Text 2 */}
        <div className="bg-white rounded-2xl border border-[#E9EAF1] p-5 shadow-xs space-y-3 relative">
          <div className="flex items-center justify-between border-b border-[#E9EAF1] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center border border-rose-200">
                2
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#20212B]">
                Input Text 2 (Perturbation / Comparison)
              </h2>
            </div>
            <select
              value={compareLang2}
              onChange={(e) => setCompareLang2(e.target.value)}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E9EAF1] bg-[#F8F9FE] text-[#20212B] font-medium focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">Auto-Detect Language</option>
              <option value="english">English</option>
              <option value="hindi">Hindi (हिन्दी)</option>
              <option value="telugu">Telugu (తెలుగు)</option>
              <option value="kannada">Kannada (ಕನ್ನಡ)</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          <textarea
            value={compareText2}
            onChange={(e) => setCompareText2(e.target.value)}
            rows={5}
            placeholder="Enter counterfactual or modified comment text..."
            className="w-full p-3.5 rounded-xl border border-[#E9EAF1] bg-[#FBFBFE] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7] focus:bg-white transition-all resize-y"
          />

          <div className="flex items-center justify-between text-[11px] text-[#858795] pt-1">
            <span>{compareText2.length} characters</span>
            <button
              type="button"
              onClick={() => setCompareText2('You are an incompetent fool and nobody wants to hear your opinion.')}
              className="text-rose-600 hover:underline font-semibold cursor-pointer"
            >
              Fill Sample Modified
            </button>
          </div>
        </div>
      </div>

      {/* ── Compare & Analyze Button ── */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleCompare}
          disabled={loading || !compareText1.trim() || !compareText2.trim()}
          className="flex items-center gap-2.5 px-8 py-3 rounded-2xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-lg shadow-[#6C5CE7]/30 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
        >
          {loading ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>Running Comparative Inference...</span>
            </>
          ) : (
            <>
              <ArrowLeftRight className="w-4 h-4" />
              <span>Compare &amp; Analyze</span>
            </>
          )}
        </button>
      </div>

      {/* ── Active Inference Comparison Results View ── */}
      {compareResult && (
        <div className="bg-white rounded-2xl border border-[#E9EAF1] p-6 shadow-xs space-y-6 page-enter">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#E9EAF1]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6C5CE7]" />
              <h2 className="text-sm font-bold text-[#20212B]">Comparative Inference Results</h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              compareResult.predictions_differ
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {compareResult.predictions_differ ? 'Predictions Differ' : 'Predictions Concordant'}
            </span>
          </div>

          {/* Side-by-Side Model Prediction Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Result for Text 1 */}
            <div className="p-4 rounded-xl border border-[#E9EAF1] bg-[#FBFBFE] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#20212B]">Text 1 Evaluation</span>
                <span className="text-[10px] font-semibold uppercase text-[#6C5CE7] bg-[#EEEAFE] px-2 py-0.5 rounded-full">
                  {compareResult.text1_analysis.detected_language}
                </span>
              </div>
              <p className="text-xs text-[#20212B] italic bg-white p-2.5 rounded-lg border border-[#E9EAF1]">
                "{compareResult.text1_analysis.original_text}"
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                  compareResult.text1_analysis.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  compareResult.text1_analysis.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Severity: {compareResult.text1_analysis.severity}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-[#E9EAF1] text-[#858795]">
                  Decision: {compareResult.text1_analysis.decision.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Category Scores Breakdown */}
              <div className="space-y-1.5 pt-1">
                {(compareResult.text1_analysis.labels || []).map((l: any) => (
                  <div key={l.label} className="flex items-center justify-between text-[11px]">
                    <span className="capitalize text-[#858795]">{l.label.replace(/_/g, ' ')}:</span>
                    <span className="font-mono font-bold text-[#20212B]">
                      {l.supported === false ? (
                        <span className="text-[10px] text-[#858795] font-normal italic">Not available</span>
                      ) : (
                        `${(l.score * 100).toFixed(1)}%`
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Result for Text 2 */}
            <div className="p-4 rounded-xl border border-[#E9EAF1] bg-[#FBFBFE] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#20212B]">Text 2 Evaluation</span>
                <span className="text-[10px] font-semibold uppercase text-[#6C5CE7] bg-[#EEEAFE] px-2 py-0.5 rounded-full">
                  {compareResult.text2_analysis.detected_language}
                </span>
              </div>
              <p className="text-xs text-[#20212B] italic bg-white p-2.5 rounded-lg border border-[#E9EAF1]">
                "{compareResult.text2_analysis.original_text}"
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                  compareResult.text2_analysis.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  compareResult.text2_analysis.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Severity: {compareResult.text2_analysis.severity}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-[#E9EAF1] text-[#858795]">
                  Decision: {compareResult.text2_analysis.decision.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Category Scores Breakdown */}
              <div className="space-y-1.5 pt-1">
                {(compareResult.text2_analysis.labels || []).map((l: any) => (
                  <div key={l.label} className="flex items-center justify-between text-[11px]">
                    <span className="capitalize text-[#858795]">{l.label.replace(/_/g, ' ')}:</span>
                    <span className="font-mono font-bold text-[#20212B]">
                      {l.supported === false ? (
                        <span className="text-[10px] text-[#858795] font-normal italic">Not available</span>
                      ) : (
                        `${(l.score * 100).toFixed(1)}%`
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Score Differences Table (Delta) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#20212B]">
              Category Score Differences &amp; Deltas (Text 2 vs Text 1)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-[#E9EAF1]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] text-[10px] font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Evaluation Dimension</th>
                    <th className="py-2.5 px-4">Text 1 Score</th>
                    <th className="py-2.5 px-4">Text 2 Score</th>
                    <th className="py-2.5 px-4">Difference (&Delta;)</th>
                    <th className="py-2.5 px-4 text-right">Relative Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F1F5]">
                  {Object.entries(compareResult.score_differences || {}).map(([dim, diffObj]: [string, any]) => {
                    const isSupported = diffObj.supported !== false;
                    const delta = diffObj.diff ?? (diffObj.text2 - diffObj.text1);
                    const isPositive = delta > 0.001;
                    const isNegative = delta < -0.001;
                    return (
                      <tr key={dim} className="hover:bg-[#F8F9FE]">
                        <td className="py-2.5 px-4 font-semibold capitalize text-[#20212B]">{dim.replace(/_/g, ' ')}</td>
                        <td className="py-2.5 px-4 font-mono">
                          {isSupported ? `${(diffObj.text1 * 100).toFixed(1)}%` : <span className="text-[10px] text-[#858795] italic">Not available</span>}
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {isSupported ? `${(diffObj.text2 * 100).toFixed(1)}%` : <span className="text-[10px] text-[#858795] italic">Not available</span>}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold">
                          {isSupported ? (
                            <span className={
                              dim === 'legitimate'
                                ? isPositive ? 'text-emerald-600' : 'text-rose-600'
                                : isPositive ? 'text-rose-600' : 'text-emerald-600'
                            }>
                              {delta > 0 ? `+${(delta * 100).toFixed(1)}%` : `${(delta * 100).toFixed(1)}%`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#858795] font-normal italic">N/A</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {isSupported ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPositive ? 'bg-rose-50 text-rose-700' : isNegative ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
                              <span>{isPositive ? 'Escalated' : isNegative ? 'Attenuated' : 'Neutral'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#858795] italic">Unrated</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {compareResult.relative_harm_assessment && (
              <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-xs text-[#20212B]">
                <span className="font-bold text-[#6C5CE7]">Harm Assessment: </span>
                <span>{compareResult.relative_harm_assessment}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Persistent Comparison History Section ── */}
      <div className="bg-white rounded-2xl border border-[#E9EAF1] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#E9EAF1]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#6C5CE7]" />
            <h2 className="text-sm font-bold text-[#20212B]">Comparison History &amp; Benchmark Audit Log</h2>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[11px] text-[#858795] hover:text-rose-600 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-[#858795] text-xs">
            No completed comparisons yet. Enter two texts above and click "Compare &amp; Analyze".
          </div>
        ) : (
          <div className="divide-y divide-[#F0F1F5]">
            {history.map((item) => {
              const r1 = item.result.text1_analysis;
              const r2 = item.result.text2_analysis;
              const toxDiff = item.result.toxicity_difference?.diff ?? 0;

              return (
                <div key={item.id} className="py-4 flex items-start justify-between gap-4 flex-wrap hover:bg-[#FBFBFE] px-2 rounded-xl transition-colors">
                  <div className="space-y-1.5 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2 text-[10px] text-[#858795]">
                      <span className="font-mono text-[#6C5CE7]">{new Date(item.timestamp).toLocaleString()}</span>
                      <span>•</span>
                      <span className={`font-bold uppercase px-1.5 py-0.5 rounded ${
                        item.result.predictions_differ ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {item.result.predictions_differ ? 'Differing Severity' : 'Concordant'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-[#F8F9FE] border border-[#E9EAF1]">
                        <span className="text-[10px] text-[#858795] font-semibold block">Text 1 ({r1.severity}):</span>
                        <p className="text-[#20212B] truncate font-medium">"{item.text1}"</p>
                      </div>
                      <div className="p-2 rounded-lg bg-[#F8F9FE] border border-[#E9EAF1]">
                        <span className="text-[10px] text-[#858795] font-semibold block">Text 2 ({r2.severity}):</span>
                        <p className="text-[#20212B] truncate font-medium">"{item.text2}"</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-center">
                    <span className={`text-xs font-mono font-bold ${toxDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {toxDiff > 0 ? `+${(toxDiff * 100).toFixed(0)}% tox` : `${(toxDiff * 100).toFixed(0)}% tox`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRestore(item)}
                      className="px-3 py-1.5 rounded-xl bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] text-xs font-bold transition-all cursor-pointer"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
