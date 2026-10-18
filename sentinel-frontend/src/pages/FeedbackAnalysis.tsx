import { useState, useEffect } from 'react';
import {
  MessageSquareWarning, AlertOctagon, CheckCircle2, AlertTriangle,
  HelpCircle, RefreshCw, Layers
} from 'lucide-react';
import { feedbackApi } from '../api/client';
import type { ErrorAnalysis, FeedbackRecord } from '../types';
import { useToast } from '../App';

export default function FeedbackAnalysis() {
  const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [errResp, listResp] = await Promise.all([
        feedbackApi.errorAnalysis(),
        feedbackApi.list({ page: 1 })
      ]);
      setAnalysis(errResp.data);
      setFeedbackList(listResp.data.items);
    } catch (err: any) {
      addToast(err.message || 'Failed to load feedback analysis', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-glow-purple">
            <MessageSquareWarning className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Feedback &amp; Error Analysis Loop</h1>
            <p className="text-sm text-slate-400">
              Track false positives, false negatives, moderator overrides, and linguistic confusion matrices.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit Metrics
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">False Positives (FP)</span>
            <AlertOctagon className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {analysis?.false_positives ?? 0}
          </div>
          <span className="text-[10px] text-amber-400/90 font-mono mt-1 block">
            Rate: {((analysis?.fp_rate ?? 0) * 100).toFixed(1)}% of reviewed cases
          </span>
        </div>

        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">False Negatives (FN)</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {analysis?.false_negatives ?? 0}
          </div>
          <span className="text-[10px] text-red-400/90 font-mono mt-1 block">
            Rate: {((analysis?.fn_rate ?? 0) * 100).toFixed(1)}% of reviewed cases
          </span>
        </div>

        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Ambiguous Cases</span>
            <HelpCircle className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {analysis?.ambiguous ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Context required</span>
        </div>

        <div className="card-glow p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Confirmed Predictions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {analysis?.confirmed ?? 0}
          </div>
          <span className="text-[10px] text-emerald-400/90 mt-1 block">Human validated</span>
        </div>
      </div>

      {/* Disparities by Language Table */}
      <div className="card-glow p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Error Distribution Across Linguistic Domains
        </h3>
        <p className="text-xs text-slate-400">
          Identifies dialects and scripts disproportionately impacted by false positive over-flagging or lexical evasion.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-navy-900/60 text-slate-400 border-b border-indigo-900/40">
              <tr>
                <th className="py-2.5 px-3">Language / Dialect</th>
                <th className="py-2.5 px-3">Total Feedback Cases</th>
                <th className="py-2.5 px-3">False Positives</th>
                <th className="py-2.5 px-3">False Negatives</th>
                <th className="py-2.5 px-3">Ambiguity Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-900/20">
              {analysis?.by_language && Object.keys(analysis.by_language).length > 0 ? (
                Object.entries(analysis.by_language).map(([lang, counts]) => (
                  <tr key={lang} className="hover:bg-indigo-950/20">
                    <td className="py-2.5 px-3 capitalize font-semibold text-slate-300">{lang}</td>
                    <td className="py-2.5 px-3 text-slate-400">{counts.total}</td>
                    <td className="py-2.5 px-3 text-amber-400 font-mono">{counts.fp}</td>
                    <td className="py-2.5 px-3 text-red-400 font-mono">{counts.fn}</td>
                    <td className="py-2.5 px-3 text-purple-400 font-mono">{counts.ambiguous}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No linguistic feedback records collected yet. Reviews submitted from the Moderator Command Center will populate here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Feedback Feed */}
      <div className="card-glow p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200">Recent Human Review Annotations</h3>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
          </div>
        ) : feedbackList.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No feedback annotations recorded.</p>
        ) : (
          <div className="space-y-2">
            {feedbackList.map(item => (
              <div key={item.id} className="p-3 rounded-lg bg-navy-900/50 border border-indigo-900/30 text-xs flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {item.is_false_positive && (
                      <span className="badge bg-amber-950/50 text-amber-400 border border-amber-800">False Positive</span>
                    )}
                    {item.is_false_negative && (
                      <span className="badge bg-red-950/50 text-red-400 border border-red-800">False Negative</span>
                    )}
                    {item.is_ambiguous && (
                      <span className="badge bg-purple-950/50 text-purple-400 border border-purple-800">Ambiguous</span>
                    )}
                    <span className="text-slate-400 font-medium capitalize">{item.language || 'English'}</span>
                  </div>
                  {item.explanation && (
                    <p className="text-slate-300 text-[11px] italic">"{item.explanation}"</p>
                  )}
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
