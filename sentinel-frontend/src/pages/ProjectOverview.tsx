import { useState, useEffect } from 'react';
import {
  Info, ShieldCheck, CheckCircle2, CircleDashed,
  Cpu, FileText, ExternalLink, Code2, AlertTriangle
} from 'lucide-react';
import { projectApi } from '../api/client';
import { useToast } from '../App';

export default function ProjectOverview() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const resp = await projectApi.overview();
        setOverview(resp.data);
      } catch (err: any) {
        addToast(err.message || 'Failed to fetch project overview', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto py-8">
        <div className="skeleton h-12 w-1/2" />
        <div className="skeleton h-48 w-full" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Hero / Identity Section */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-purple-950/40 via-navy-800 to-navy-900 border border-indigo-900/40 space-y-3 shadow-glow-purple">
        <div className="flex items-center gap-2">
          <span className="badge bg-purple-900/50 text-purple-300 border border-purple-700/50">
            {overview?.project_id || 'CSEAIML2026-P03'}
          </span>
          <span className="text-xs text-slate-400">Academic &amp; Research Prototype</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {overview?.title || 'NLP-Based Hate Speech and Cyberbullying Detection System for Social Media'}
        </h1>
        <p className="text-sm text-purple-300 font-medium italic">
          "{overview?.tagline || 'Understand Context. Detect Harm. Protect Conversations.'}"
        </p>
        <div className="p-4 rounded-xl bg-navy-950/60 border border-indigo-950 text-xs text-slate-300 space-y-1">
          <strong className="text-white block font-semibold">Core Research Question:</strong>
          <p className="leading-relaxed text-slate-300">{overview?.research_question}</p>
        </div>
      </div>

      {/* Problem Statement & Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-glow p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Problem Statement &amp; Real-World Motivation
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {overview?.problem_statement}
          </p>
        </div>

        <div className="card-glow p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Core Research Objectives
          </h2>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
            {overview?.objectives?.map((obj: string, i: number) => (
              <li key={i} className="leading-relaxed">{obj}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Distinction: Implemented vs Planned Features */}
      <div className="card-glow p-6 space-y-6">
        <h2 className="text-base font-bold text-white">System Implementation Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Implemented */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              Verified &amp; Implemented Features
            </div>
            <ul className="space-y-2 text-xs">
              {overview?.implemented_features?.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-slate-300">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Planned */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <CircleDashed className="w-4 h-4" />
              Planned &amp; Future Roadmap
            </div>
            <ul className="space-y-2 text-xs">
              {overview?.planned_features?.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-slate-400">
                  <span className="text-indigo-400 font-bold shrink-0">○</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Responsible AI & Fairness Policy */}
      <div className="card-glow p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-purple-400" />
          Responsible AI, Fairness &amp; Safety Policy
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {overview?.responsible_ai && Object.entries(overview.responsible_ai).map(([k, v]: [string, any]) => (
            <div key={k} className="p-3 rounded-lg bg-navy-900/60 border border-indigo-950 space-y-1">
              <div className="font-semibold text-slate-200 capitalize">{k.replace(/_/g, ' ')}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Sources & References */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-400" />
            Dataset Provenance &amp; Benchmark Corpora
          </h3>
          <div className="space-y-2">
            {overview?.dataset_sources?.map((ds: any, i: number) => (
              <div key={i} className="p-2.5 rounded bg-navy-900/50 border border-indigo-950">
                <div className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>{ds.name}</span>
                  <a href={ds.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 text-[10px]">
                    Link <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{ds.note}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-purple-400" />
            Scholarly Citations &amp; References
          </h3>
          <ul className="space-y-2 text-[11px] text-slate-400 list-disc list-inside">
            {overview?.references?.map((ref: string, i: number) => (
              <li key={i} className="leading-relaxed">{ref}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
