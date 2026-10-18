import { useState, useEffect } from 'react';
import {
  ShieldAlert, Search, Filter, CheckCircle, XCircle, AlertTriangle,
  Clock, Download, ChevronLeft, ChevronRight, X, ExternalLink
} from 'lucide-react';
import { moderationApi, feedbackApi } from '../api/client';
import type { ModerationRecord, ModerationDetail } from '../types';
import { useToast } from '../App';

export default function ModerationCenter() {
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
  }, [page, statusFilter, severityFilter, languageFilter]);

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
        reviewer_id: 'moderator_1',
        reviewer_name: 'Lead Moderator',
      });

      // Submit feedback automatically if severity was changed or action is dismiss (false positive)
      if (reviewAction === 'dismiss' || correctedSeverity !== detail?.severity) {
        await feedbackApi.submit({
          record_id: selectedId,
          is_false_positive: reviewAction === 'dismiss',
          predicted_severity: detail?.severity,
          corrected_severity: correctedSeverity,
          explanation: overrideReason || reviewerNotes || 'Moderator override',
          language: detail?.detected_language,
          model_version: detail?.model_version,
        });
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
    link.setAttribute('download', `sentinel_moderation_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Records exported to CSV', 'info');
  };

  return (
    <div className="space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-glow-purple">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Moderator Command Center</h1>
            <p className="text-sm text-slate-400">Review flagged conversations, evaluate contextual evidence, and apply human overrides.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-xs">
            <Download className="w-3.5 h-3.5" /> Export to CSV
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-glow p-4 flex flex-wrap gap-3 items-center justify-between">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search comments or record text..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          <button type="submit" className="btn-primary text-xs px-3">Search</button>
        </form>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="select-field w-32 py-1.5 text-xs"
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
            className="select-field w-32 py-1.5 text-xs"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="uncertain">Uncertain</option>
          </select>

          <select
            value={languageFilter}
            onChange={e => { setLanguageFilter(e.target.value); setPage(1); }}
            className="select-field w-32 py-1.5 text-xs"
          >
            <option value="">All Languages</option>
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="telugu">Telugu</option>
            <option value="kannada">Kannada</option>
            <option value="code_mixed">Code-Mixed</option>
          </select>

          {(statusFilter || severityFilter || languageFilter || search) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setSeverityFilter('');
                setLanguageFilter('');
                setSearch('');
                setPage(1);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Records Table */}
      <div className="card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-navy-900/60 border-b border-indigo-900/40 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Comment Text</th>
                <th className="py-3 px-3">Language</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Scores (HS / Har / CB)</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-900/20">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-4 px-4"><div className="skeleton h-5 w-full" /></td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No moderation records match your current criteria.
                  </td>
                </tr>
              ) : (
                records.map(rec => (
                  <tr key={rec.id} className="hover:bg-indigo-950/20 transition-colors">
                    <td className="py-3 px-4 max-w-md">
                      <div className="text-slate-200 line-clamp-2">{rec.original_text}</div>
                      {rec.is_demo && <span className="inline-block mt-0.5 text-[9px] text-amber-500 font-bold bg-amber-950/40 px-1 rounded">DEMO RECORD</span>}
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-400">{rec.detected_language}</td>
                    <td className="py-3 px-3">
                      <span className={`badge severity-${rec.severity}`}>{rec.severity}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      <span className={rec.hate_speech_score > 0.4 ? 'text-red-400 font-semibold' : ''}>{(rec.hate_speech_score * 100).toFixed(0)}%</span> /{' '}
                      <span className={rec.harassment_score > 0.4 ? 'text-amber-400 font-semibold' : ''}>{(rec.harassment_score * 100).toFixed(0)}%</span> /{' '}
                      <span className={rec.cyberbullying_score > 0.4 ? 'text-purple-400 font-semibold' : ''}>{(rec.cyberbullying_score * 100).toFixed(0)}%</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`badge status-${rec.status}`}>{rec.status}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(rec.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openDetail(rec.id)}
                        className="btn-primary text-xs px-2.5 py-1"
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
        <div className="p-3 bg-navy-900/40 border-t border-indigo-900/40 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-medium">{records.length}</span> of <span className="text-white font-medium">{total}</span> records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Review Drawer / Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-navy-800 border-l border-indigo-900/60 h-full overflow-y-auto p-6 space-y-6 shadow-2xl slide-in-right">
            <div className="flex items-center justify-between pb-4 border-b border-indigo-900/40">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Review Case Detail</h2>
              </div>
              <button
                onClick={() => { setSelectedId(null); setDetail(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-navy-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail || !detail ? (
              <div className="space-y-4 py-8">
                <div className="skeleton h-8 w-3/4" />
                <div className="skeleton h-24 w-full" />
                <div className="skeleton h-16 w-full" />
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Text & Context */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target Comment</h3>
                  <div className="p-3 rounded-lg bg-navy-900/80 border border-indigo-900/40 text-sm text-white font-medium">
                    {detail.original_text}
                  </div>

                  {(detail.context_before || detail.context_after) && (
                    <div className="p-3 rounded-lg bg-navy-900/40 border border-indigo-900/30 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">Conversation Context</span>
                      {detail.context_before && (
                        <div className="text-slate-400"><strong className="text-slate-300">Previous:</strong> {detail.context_before}</div>
                      )}
                      {detail.context_after && (
                        <div className="text-slate-400"><strong className="text-slate-300">Reply:</strong> {detail.context_after}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Model Predictions */}
                <div className="p-3 rounded-lg bg-navy-900/50 border border-indigo-900/30 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-300">Model Recommendation</span>
                    <span className="badge bg-indigo-950 text-indigo-300 border border-indigo-800">{detail.model_name} v{detail.model_version}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div>Severity: <span className={`badge severity-${detail.severity}`}>{detail.severity}</span></div>
                    <div>Decision: <strong className="text-slate-200 capitalize">{detail.decision.replace(/_/g, ' ')}</strong></div>
                  </div>
                  {detail.severity_reason && (
                    <div className="text-[11px] text-slate-400 mt-1">Evidence: {detail.severity_reason}</div>
                  )}
                  {detail.ambiguity_warning && (
                    <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {detail.ambiguity_warning}
                    </div>
                  )}
                </div>

                {/* Audit & Review History */}
                {detail.reviews && detail.reviews.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-400 uppercase tracking-wider">Review History</span>
                    <div className="space-y-2">
                      {detail.reviews.map(r => (
                        <div key={r.id} className="p-2.5 rounded bg-navy-900/30 border border-indigo-950">
                          <div className="flex justify-between text-slate-300 font-medium">
                            <span>Action: {r.action}</span>
                            <span className="text-slate-500 text-[10px]">{new Date(r.created_at).toLocaleString()}</span>
                          </div>
                          {r.override_reason && <div className="text-slate-400 mt-1">Reason: {r.override_reason}</div>}
                          {r.reviewer_notes && <div className="text-slate-500 mt-0.5">Notes: {r.reviewer_notes}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Form */}
                <form onSubmit={handleDecisionSubmit} className="pt-4 border-t border-indigo-900/40 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Moderator Decision</h3>

                  <div>
                    <label className="label">Action</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'approve', label: 'Approve Content', desc: 'No violation' },
                        { id: 'dismiss', label: 'Dismiss / False Pos', desc: 'Ignore warning' },
                        { id: 'escalate', label: 'Escalate Harm', desc: 'Enforce violation' },
                        { id: 'further_review', label: 'Needs Investigation', desc: 'Keep in queue' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setReviewAction(opt.id as any)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            reviewAction === opt.id
                              ? 'bg-indigo-600/30 border-indigo-500 text-white'
                              : 'bg-navy-900/40 border-indigo-950 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-[10px] opacity-75">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Override Severity (Optional)</label>
                    <select
                      value={correctedSeverity}
                      onChange={e => setCorrectedSeverity(e.target.value)}
                      className="select-field text-xs"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="uncertain">Uncertain</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Override / Decision Rationale</label>
                    <textarea
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      rows={2}
                      className="input-field text-xs"
                      placeholder="Explain why this decision was taken (saved to audit trail & feedback dataset)..."
                    />
                  </div>

                  <div>
                    <label className="label">Internal Reviewer Notes</label>
                    <input
                      type="text"
                      value={reviewerNotes}
                      onChange={e => setReviewerNotes(e.target.value)}
                      className="input-field text-xs"
                      placeholder="Notes visible to other moderators..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedId(null); setDetail(null); }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="btn-primary flex items-center gap-2"
                    >
                      {submittingReview ? 'Recording...' : 'Submit Consequential Decision'}
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
