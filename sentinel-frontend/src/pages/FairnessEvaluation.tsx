import { useState, useEffect } from 'react';
import {
  Scale, Play, AlertCircle, CheckCircle2, FileText,
  BarChart2, Info, ArrowUpRight, ShieldCheck, Download
} from 'lucide-react';
import { evaluationApi } from '../api/client';
import type { EvaluationRun } from '../types';
import { useToast } from '../App';

export default function FairnessEvaluation() {
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningEval, setRunningEval] = useState(false);
  const { addToast } = useToast();

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const resp = await evaluationApi.list();
      setRuns(resp.data);
      if (resp.data.length > 0) {
        setSelectedRun(resp.data[0]);
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to load evaluation history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleTriggerEvaluation = async () => {
    setRunningEval(true);
    try {
      const resp = await evaluationApi.run();
      addToast(resp.data.message || 'Evaluation run completed', 'info');
      await fetchRuns();
    } catch (err: any) {
      addToast(err.message || 'Evaluation run failed', 'error');
    } finally {
      setRunningEval(false);
    }
  };

  const exportReport = () => {
    if (!selectedRun) return;
    const reportData = {
      title: "Sentinel AI Research Evaluation & Fairness Report",
      timestamp: new Date().toISOString(),
      run: selectedRun,
      methodology: "Multilingual multi-label evaluation using macro & micro precision, recall, and F1 across target scripts.",
      responsible_ai_disclaimer: "Metrics represent evaluation on specific test batches. Insufficient data status is honestly declared when labeled ground truth is missing."
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentinel_eval_report_${selectedRun.id.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Research report downloaded', 'success');
  };

  return (
    <div className="space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-glow-purple">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Fairness & Evaluation Observatory</h1>
            <p className="text-sm text-slate-400">
              Audit model performance, demographic &amp; language disparities, and verified metric integrity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportReport}
            disabled={!selectedRun}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download Research Report
          </button>
          <button
            onClick={handleTriggerEvaluation}
            disabled={runningEval}
            className="btn-primary flex items-center gap-2 text-xs"
          >
            <Play className={`w-3.5 h-3.5 ${runningEval ? 'animate-spin' : ''}`} />
            {runningEval ? 'Evaluating...' : 'Run New Evaluation'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Runs List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card-glow p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Evaluation Runs</h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
              </div>
            ) : runs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No evaluation runs recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {runs.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRun(r)}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                      selectedRun?.id === r.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-navy-900/40 border-indigo-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold text-slate-200 truncate">{r.run_name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString()} • {r.total_samples} samples
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Evaluation Honesty Notice
            </div>
            <p className="text-[11px] leading-relaxed">
              Sentinel AI adheres to reproducible research standards. We never synthesize or hardcode inflated F1 metrics. When ground truth is absent, status is flagged as <strong>Insufficient Data</strong>.
            </p>
          </div>
        </div>

        {/* Right: Selected Run Details */}
        <div className="lg:col-span-3 space-y-6">
          {selectedRun ? (
            <>
              {/* Top Summary Card */}
              <div className="card-glow p-5 space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      {selectedRun.run_name}
                      <span className="badge bg-indigo-900/40 text-indigo-300 border border-indigo-700/40">
                        {selectedRun.status}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Model: <strong>{selectedRun.model_name} v{selectedRun.model_version}</strong> • Dataset: <strong>{selectedRun.dataset_name || 'Database records'}</strong>
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">ID: {selectedRun.id.slice(0, 8)}</span>
                </div>

                {/* Overall Metrics Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-navy-900/60 rounded-lg border border-indigo-900/30 text-center">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Evaluated Samples</span>
                    <div className="text-lg font-bold text-white mt-1">{selectedRun.total_samples}</div>
                  </div>
                  <div className="p-3 bg-navy-900/60 rounded-lg border border-indigo-900/30 text-center">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Macro Precision</span>
                    <div className="text-lg font-bold text-slate-300 mt-1">
                      {(selectedRun.overall_metrics as any)?.precision ?? 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 bg-navy-900/60 rounded-lg border border-indigo-900/30 text-center">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Macro Recall</span>
                    <div className="text-lg font-bold text-slate-300 mt-1">
                      {(selectedRun.overall_metrics as any)?.recall ?? 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 bg-navy-900/60 rounded-lg border border-indigo-900/30 text-center">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Macro F1 Score</span>
                    <div className="text-lg font-bold text-slate-300 mt-1">
                      {(selectedRun.overall_metrics as any)?.f1 ?? 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedRun.notes && (
                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{selectedRun.notes}</span>
                  </div>
                )}
              </div>

              {/* Per-Language Fairness Breakdown */}
              <div className="card-glow p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  Multilingual Evaluation &amp; Disparity Analysis
                </h3>
                <p className="text-xs text-slate-400">
                  Audit whether the system performs equitably across English, Dravidian, and code-mixed scripts.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-navy-900/60 text-slate-400 border-b border-indigo-900/40">
                      <tr>
                        <th className="py-2.5 px-3">Target Language / Script</th>
                        <th className="py-2.5 px-3">Evaluation Status</th>
                        <th className="py-2.5 px-3">Sample Count</th>
                        <th className="py-2.5 px-3">Observed Disparity Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-900/20">
                      {[
                        { lang: 'English', script: 'Latin', status: 'Baseline Active', count: 'Standard', note: 'Strongest lexical coverage; prone to false positives on sarcasm' },
                        { lang: 'Hindi', script: 'Devanagari', status: 'Script Filter Active', count: 'Limited', note: 'Requires transliterated and Devanagari labeled corpora' },
                        { lang: 'Telugu', script: 'Telugu', status: 'Script Filter Active', count: 'Limited', note: 'High transliteration variance (e.g. Telugu in Latin script)' },
                        { lang: 'Kannada', script: 'Kannada', status: 'Script Filter Active', count: 'Limited', note: 'Under-resourced benchmark datasets available in FIRE tasks' },
                        { lang: 'Code-Mixed', script: 'Latin + Indic Markers', status: 'Heuristic Marker Active', count: 'Pilot', note: 'High lexical ambiguity; contextual embeddings required' },
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-indigo-950/20">
                          <td className="py-2.5 px-3 font-medium text-slate-300">
                            {row.lang} <span className="text-[10px] text-slate-500 font-mono">({row.script})</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="badge bg-navy-700 text-slate-300 border border-slate-700">{row.status}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{row.count}</td>
                          <td className="py-2.5 px-3 text-slate-500">{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Research Methodology Accordion / Section */}
              <div className="card p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Research Benchmark Protocols
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
                  <div className="p-3 bg-navy-900/40 rounded-lg border border-indigo-950 space-y-1">
                    <strong className="text-slate-200">Macro vs Micro Averaging</strong>
                    <p className="text-[11px] leading-relaxed">
                      We prioritize macro-F1 over micro-F1 to guarantee that severe but lower-frequency categories (such as explicit Hate Speech) receive equal weight compared to common neutral discussion.
                    </p>
                  </div>
                  <div className="p-3 bg-navy-900/40 rounded-lg border border-indigo-950 space-y-1">
                    <strong className="text-slate-200">Zero-Shot Transformer Roadmap</strong>
                    <p className="text-[11px] leading-relaxed">
                      Planned migration to fine-tuned XLM-RoBERTa will replace lexical pattern matching, addressing transliteration and Dravidian morphological complexity.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card-glow p-8 text-center text-slate-500">
              Select or run an evaluation to observe research metrics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
