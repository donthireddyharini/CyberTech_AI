import { useState, useEffect, useMemo } from 'react';
import {
  MessageSquareWarning, AlertOctagon, CheckCircle2, AlertTriangle,
  HelpCircle, RefreshCw, Layers, Sparkles, Search, Filter,
  ArrowRight, Check, X, Copy, ExternalLink, Download, ChevronRight,
  ShieldAlert, Info, Clock, Globe, UserCheck
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { feedbackApi, moderationApi } from '../api/client';
import type { ErrorAnalysis, FeedbackRecord } from '../types';
import { useToast } from '../App';
import { useTranslation } from '../i18n/I18nContext';

const PIE_COLORS = {
  confirmed: '#00B894',    // Emerald
  false_positive: '#FDCB6E', // Amber
  false_negative: '#FF7675', // Rose
  ambiguous: '#6C5CE7',    // Purple
};

function CustomFeedbackPieTooltip({ active, payload, total }: any) {
  if (active && payload && payload.length) {
    const item = payload[0];
    const fill = item.payload?.color || item.payload?.fill || item.color || '#6C5CE7';
    const val = Number(item.value) || 0;
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
    const name = String(item.name || '');

    return (
      <div className="z-50 px-3.5 py-2.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#E9EAF1] shadow-xl pointer-events-none min-w-[150px] animate-in fade-in duration-150">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: fill }} />
          <span className="text-xs font-bold text-[#20212B] capitalize tracking-wide truncate">{name}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[#20212B]">
          <span className="text-sm font-black text-[#20212B] tabular-nums">{val.toLocaleString()}</span>
          <span className="text-[11px] text-[#6C5CE7] font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="text-[10px] text-[#858795] font-medium mt-0.5">
          {val === 1 ? '1 review case' : `${val.toLocaleString()} review cases`} ({pct}% of total)
        </div>
      </div>
    );
  }
  return null;
}

export default function FeedbackAnalysis() {
  const [analysis, setAnalysis] = useState<ErrorAnalysis | null>(null);
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'confirmed' | 'false_positive' | 'false_negative' | 'ambiguous'>('all');
  const [selectedLangFilter, setSelectedLangFilter] = useState<string>('all');
  const [activePieIndex, setActivePieIndex] = useState<number>(-1);
  
  // Drawer / Investigation State
  const [selectedItem, setSelectedItem] = useState<FeedbackRecord | null>(null);
  const [drawerDecision, setDrawerDecision] = useState<'correct' | 'false_positive' | 'false_negative' | 'ambiguous' | null>(null);
  const [drawerExplanation, setDrawerExplanation] = useState('');
  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false);

  const { addToast } = useToast();
  const { t } = useTranslation();

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius - 2}
          outerRadius={outerRadius + 3}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          cornerRadius={3}
          style={{
            filter: `drop-shadow(0px 2px 6px ${fill}55)`,
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'pointer'
          }}
        />
      </g>
    );
  };

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const [errResp, listResp] = await Promise.all([
        feedbackApi.errorAnalysis(),
        feedbackApi.list({ page: 1 })
      ]);
      setAnalysis(errResp.data);
      setFeedbackList(listResp.data.items);
      if (isManual) {
        addToast('Feedback & Error metrics refreshed with latest human ground truth.', 'success');
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to load feedback analysis', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered feedback list
  const filteredList = useMemo(() => {
    return feedbackList.filter(item => {
      // Type filter
      if (selectedTypeFilter === 'confirmed' && !item.is_confirmed) return false;
      if (selectedTypeFilter === 'false_positive' && !item.is_false_positive) return false;
      if (selectedTypeFilter === 'false_negative' && !item.is_false_negative) return false;
      if (selectedTypeFilter === 'ambiguous' && !item.is_ambiguous) return false;

      // Language filter
      if (selectedLangFilter !== 'all') {
        const itemLang = (item.language || 'english').toLowerCase();
        if (!itemLang.includes(selectedLangFilter.toLowerCase())) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesExplanation = item.explanation?.toLowerCase().includes(query);
        const matchesLang = item.language?.toLowerCase().includes(query);
        const matchesId = item.id.toLowerCase().includes(query) || (item.record_id && item.record_id.toLowerCase().includes(query));
        if (!matchesExplanation && !matchesLang && !matchesId) return false;
      }

      return true;
    });
  }, [feedbackList, selectedTypeFilter, selectedLangFilter, searchQuery]);

  // Open Drawer for investigation with reliable comment text & metrics hydration
  const openInvestigation = async (item: FeedbackRecord) => {
    let targetItem: FeedbackRecord = { ...item };
    if ((!targetItem.comment_text || targetItem.comment_text.trim() === '') && targetItem.record_id) {
      try {
        const detailResp = await moderationApi.getDetail(targetItem.record_id);
        if (detailResp.data) {
          targetItem = {
            ...targetItem,
            comment_text: detailResp.data.original_text || detailResp.data.normalized_text || targetItem.comment_text,
            severity: detailResp.data.severity || targetItem.severity,
            decision: detailResp.data.decision || targetItem.decision,
            platform: detailResp.data.platform || targetItem.platform,
            language: detailResp.data.detected_language || targetItem.language,
            hate_speech_score: detailResp.data.hate_speech_score ?? targetItem.hate_speech_score,
            harassment_score: detailResp.data.harassment_score ?? targetItem.harassment_score,
            cyberbullying_score: detailResp.data.cyberbullying_score ?? targetItem.cyberbullying_score,
            legitimate_score: detailResp.data.legitimate_score ?? targetItem.legitimate_score,
          };
        }
      } catch (err) {
        console.warn('Could not fetch moderation detail for record:', targetItem.record_id, err);
      }
    }
    setSelectedItem(targetItem);
    setDrawerExplanation(targetItem.explanation || '');
    if (targetItem.is_confirmed) setDrawerDecision('correct');
    else if (targetItem.is_false_positive) setDrawerDecision('false_positive');
    else if (targetItem.is_false_negative) setDrawerDecision('false_negative');
    else if (targetItem.is_ambiguous) setDrawerDecision('ambiguous');
    else setDrawerDecision(null);
  };

  // Submit decision update (upsert)
  const handleUpdateDecision = async () => {
    if (!selectedItem || !drawerDecision) return;
    setIsUpdatingDecision(true);
    try {
      await feedbackApi.submit({
        record_id: selectedItem.record_id || selectedItem.id,
        is_confirmed: drawerDecision === 'correct',
        is_false_positive: drawerDecision === 'false_positive',
        is_false_negative: drawerDecision === 'false_negative',
        is_ambiguous: drawerDecision === 'ambiguous',
        explanation: drawerExplanation || `Updated review decision: ${drawerDecision}`,
        language: selectedItem.language || 'english',
        model_version: selectedItem.model_version || '1.0.0',
      });
      addToast(`Updated review decision to ${drawerDecision.replace(/_/g, ' ')} successfully.`, 'success');
      setSelectedItem(null);
      await fetchData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update review decision', 'error');
    } finally {
      setIsUpdatingDecision(false);
    }
  };

  // Distribution chart data
  const pieData = useMemo(() => {
    if (!analysis) return [];
    return [
      { name: 'Confirmed Correct', value: analysis.confirmed || 0, color: PIE_COLORS.confirmed },
      { name: 'False Positives', value: analysis.false_positives || 0, color: PIE_COLORS.false_positive },
      { name: 'False Negatives', value: analysis.false_negatives || 0, color: PIE_COLORS.false_negative },
      { name: 'Ambiguous', value: analysis.ambiguous || 0, color: PIE_COLORS.ambiguous },
    ].filter(d => d.value > 0);
  }, [analysis]);

  return (
    <div className="space-y-8 max-w-screen-2xl page-enter pb-16">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER: TITLE, MISSION NOTICE & ACTIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-4 sm:p-6 relative overflow-hidden rounded-2xl border border-[#E9EAF1] shadow-xs">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] shadow-xs shrink-0">
              <MessageSquareWarning className="w-5 h-5 text-[#6C5CE7]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-[#20212B] tracking-tight">
                  {t('feedback.title', 'Feedback & Error Analysis Studio')}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] whitespace-nowrap">
                  Human-in-the-Loop Ground Truth
                </span>
              </div>
              <p className="text-xs text-[#858795] mt-1 max-w-3xl leading-relaxed">
                Empirically track model false alarms, audit evasive harassment cases, and refine decision thresholds across Telugu, Hindi, Kannada, Hinglish, and English.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2.5 w-full sm:w-auto">
            <a
              href={feedbackApi.exportUrl('csv')}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] text-[#20212B] text-xs font-semibold shadow-xs transition-all active:scale-95"
              title="Download human feedback records as CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#6C5CE7] shrink-0" />
              <span>Export CSV</span>
            </a>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh Metrics'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION A: 5 REVIEW OVERVIEW METRIC TILES
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* 1. Total Reviewed */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#E9EAF1] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs text-[#858795] font-semibold tracking-wide uppercase">
              Total Reviewed
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] shrink-0">
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#6C5CE7]" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-[#20212B] mt-2 tabular-nums">
            {analysis?.total_feedback ?? 0}
          </div>
          <span className="text-[10px] sm:text-[11px] text-[#6C5CE7] mt-1 block font-medium">
            Denominator Base
          </span>
          <span className="text-[10px] text-[#858795] mt-0.5 block">Total verified judgements</span>
        </div>

        {/* 2. Confirmed Predictions */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#E9EAF1] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs text-[#858795] font-semibold tracking-wide uppercase">
              Confirmed Correct
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-[#20212B] mt-2 tabular-nums">
            {analysis?.confirmed ?? 0}
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-600 mt-1 block font-medium tabular-nums">
            {analysis?.total_feedback ? `${(((analysis.confirmed || 0) / analysis.total_feedback) * 100).toFixed(1)}% concordance` : 'No cases'}
          </span>
          <span className="text-[10px] text-[#858795] mt-0.5 block">Verified correct</span>
        </div>

        {/* 3. False Positives (FP) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#E9EAF1] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs text-[#858795] font-semibold tracking-wide uppercase">
              False Positives
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <AlertOctagon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-[#20212B] mt-2 tabular-nums">
            {analysis?.false_positives ?? 0}
          </div>
          <span className="text-[10px] sm:text-[11px] text-amber-600 mt-1 block font-medium tabular-nums">
            Rate: {((analysis?.fp_rate ?? 0) * 100).toFixed(1)}% of reviewed
          </span>
          <span className="text-[10px] text-[#858795] mt-0.5 block">Benign flagged harmful</span>
        </div>

        {/* 4. False Negatives (FN) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#E9EAF1] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs text-[#858795] font-semibold tracking-wide uppercase">
              False Negatives
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-[#20212B] mt-2 tabular-nums">
            {analysis?.false_negatives ?? 0}
          </div>
          <span className="text-[10px] sm:text-[11px] text-rose-600 mt-1 block font-medium tabular-nums">
            Rate: {((analysis?.fn_rate ?? 0) * 100).toFixed(1)}% of reviewed
          </span>
          <span className="text-[10px] text-[#858795] mt-0.5 block">Harmful evaded detection</span>
        </div>

        {/* 5. Ambiguous Cases */}
        <div className="col-span-2 lg:col-span-1 bg-white p-3.5 sm:p-5 rounded-2xl border border-[#E9EAF1] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] sm:text-xs text-[#858795] font-semibold tracking-wide uppercase">
              Ambiguous Cases
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] shrink-0">
              <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#6C5CE7]" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-[#20212B] mt-2 tabular-nums">
            {analysis?.ambiguous ?? 0}
          </div>
          <span className="text-[10px] sm:text-[11px] text-[#6C5CE7] mt-1 block font-medium">
            Context Lab verification
          </span>
          <span className="text-[10px] text-[#858795] mt-0.5 block">Sarcasm, cultural slang, or dialect</span>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION B: DUAL VISUALIZATIONS (DISTRIBUTION & LINGUISTIC PATTERNS)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Decision Breakdown Donut */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9EAF1] shadow-xs lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-[#6C5CE7]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#20212B]">
                Ground Truth Verdict Breakdown
              </h3>
            </div>
            <p className="text-[11px] text-[#858795]">
              Proportion of model outputs verified against human ground truth.
            </p>
          </div>

          <div className="py-4 flex items-center justify-center">
            {pieData.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-[#858795] text-xs text-center px-4">
                <HelpCircle className="w-8 h-8 mb-2 opacity-30 text-[#6C5CE7]" />
                <span>No review decisions logged yet. Submit reviews in the Moderator Command Center to see live error distributions.</span>
              </div>
            ) : (
              <div className="relative w-full h-44 flex items-center justify-center overflow-hidden">
                <div key={activePieIndex >= 0 ? undefined : (analysis?.total_feedback || 0)} className="w-full h-full flex items-center justify-center donut-circle-container">
                  <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      startAngle={90}
                      endAngle={-270}
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={2.5}
                      cornerRadius={3}
                      dataKey="value"
                      activeIndex={activePieIndex}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, index) => setActivePieIndex(index)}
                      onMouseLeave={() => setActivePieIndex(-1)}
                      cursor="pointer"
                      isAnimationActive={true}
                      animationDuration={850}
                      animationEasing="ease-out"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                          opacity={activePieIndex === -1 || activePieIndex === index ? 1 : 0.45}
                          style={{ transition: 'opacity 0.22s ease-out' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<CustomFeedbackPieTooltip total={analysis?.total_feedback || pieData.reduce((a, b) => a + b.value, 0)} />}
                      wrapperStyle={{ outline: 'none', zIndex: 100 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                </div>

                {/* Dynamic Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center px-2">
                  {activePieIndex >= 0 && pieData[activePieIndex] ? (
                    <>
                      <span className="text-sm font-black text-[#20212B] tracking-tight tabular-nums leading-none truncate max-w-[80px]">
                        {pieData[activePieIndex].value.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-[#6C5CE7] font-semibold capitalize tracking-tight truncate max-w-[80px] mt-0.5">
                        {pieData[activePieIndex].name}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-base font-black text-[#20212B] tracking-tight tabular-nums leading-none">
                        {(analysis?.total_feedback || pieData.reduce((a, b) => a + b.value, 0)).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#858795] font-medium mt-0.5">Reviewed</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Bidirectional Legend */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E9EAF1] text-[11px]">
            {[
              { key: 'Confirmed Correct', label: 'Confirmed', count: analysis?.confirmed ?? 0, color: '#00B894', idx: pieData.findIndex(p => p.name === 'Confirmed Correct') },
              { key: 'False Positives', label: 'False Pos.', count: analysis?.false_positives ?? 0, color: '#FDCB6E', idx: pieData.findIndex(p => p.name === 'False Positives') },
              { key: 'False Negatives', label: 'False Neg.', count: analysis?.false_negatives ?? 0, color: '#FF7675', idx: pieData.findIndex(p => p.name === 'False Negatives') },
              { key: 'Ambiguous', label: 'Ambiguous', count: analysis?.ambiguous ?? 0, color: '#6C5CE7', idx: pieData.findIndex(p => p.name === 'Ambiguous') },
            ].map((leg) => {
              const isHovered = leg.idx !== -1 && activePieIndex === leg.idx;
              return (
                <div
                  key={leg.key}
                  onMouseEnter={() => leg.idx !== -1 && setActivePieIndex(leg.idx)}
                  onMouseLeave={() => setActivePieIndex(-1)}
                  className={`flex items-center gap-1.5 p-1 rounded-lg cursor-pointer transition-all ${
                    isHovered ? 'bg-[#F8F9FE] text-[#20212B] shadow-xs' : 'text-[#858795] hover:bg-[#F8F9FE]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                    style={{
                      backgroundColor: leg.color,
                      transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                      boxShadow: isHovered ? `0 0 8px ${leg.color}` : 'none'
                    }}
                  />
                  <span className={isHovered ? 'font-bold text-[#20212B]' : ''}>
                    {leg.label} ({leg.count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Linguistic Disparities Table */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9EAF1] shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-[#6C5CE7]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#20212B]">
                  Linguistic Domain Error Disparities
                </h3>
              </div>
              <p className="text-[11px] text-[#858795]">
                Audits regional languages disproportionately impacted by false alarms or undetected harassment.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E9EAF1]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3.5">Language Domain</th>
                  <th className="py-2.5 px-3">Total Cases</th>
                  <th className="py-2.5 px-3 text-amber-600">False Positives</th>
                  <th className="py-2.5 px-3 text-rose-600">False Negatives</th>
                  <th className="py-2.5 px-3 text-[#6C5CE7]">Ambiguity Flags</th>
                  <th className="py-2.5 px-3.5 text-right">Error Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F5]">
                {analysis?.by_language && Object.keys(analysis.by_language).length > 0 ? (
                  Object.entries(analysis.by_language).map(([lang, counts]) => {
                    const errorCount = (counts.fp || 0) + (counts.fn || 0);
                    const rate = counts.total > 0 ? ((errorCount / counts.total) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={lang} className="hover:bg-[#F8F9FE] transition-colors">
                        <td className="py-2.5 px-3.5 capitalize font-bold text-[#20212B] flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6C5CE7]" />
                          <span>{lang}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#20212B] tabular-nums">{counts.total}</td>
                        <td className="py-2.5 px-3 text-amber-600 font-semibold tabular-nums">{counts.fp}</td>
                        <td className="py-2.5 px-3 text-rose-600 font-semibold tabular-nums">{counts.fn}</td>
                        <td className="py-2.5 px-3 text-[#6C5CE7] font-semibold tabular-nums">{counts.ambiguous}</td>
                        <td className="py-2.5 px-3.5 text-right text-[#6C5CE7] font-semibold tabular-nums">{rate}%</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#858795] text-xs">
                      No linguistic feedback records collected yet. Reviews submitted from the Moderator Command Center will populate here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION C: INTERACTIVE CASE INVESTIGATION WORKSPACE & TABLE
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E9EAF1] shadow-xs space-y-5">
        
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#20212B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6C5CE7] shrink-0" />
              <span>Human Review Annotations &amp; Case Investigation</span>
            </h3>
            <p className="text-xs text-[#858795] mt-0.5">
              Select any review case to investigate the ground-truth evidence, inspect model predictions, or update the recorded verdict.
            </p>
          </div>

          <div className="text-xs text-[#858795] bg-[#F8F9FE] px-3 py-1.5 rounded-xl border border-[#E9EAF1]">
            Showing <strong className="text-[#20212B]">{filteredList.length}</strong> of {feedbackList.length} records
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-[#858795] absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by explanation, language, or ID..."
              className="w-full pl-9 pr-3 py-2 bg-[#FBFBFE] border border-[#E9EAF1] rounded-xl text-xs text-[#20212B] placeholder-[#858795] focus:bg-white focus:outline-none focus:border-[#6C5CE7] transition-colors"
            />
          </div>

          {/* Verdict Filter */}
          <div className="sm:col-span-4 flex items-center gap-1.5 bg-[#FBFBFE] border border-[#E9EAF1] rounded-xl px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-[#858795] shrink-0" />
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
              className="w-full bg-transparent text-xs text-[#20212B] focus:outline-none cursor-pointer py-1"
            >
              <option value="all">All Verdicts</option>
              <option value="confirmed">Confirmed Correct</option>
              <option value="false_positive">False Positives (FP)</option>
              <option value="false_negative">False Negatives (FN)</option>
              <option value="ambiguous">Ambiguous Cases</option>
            </select>
          </div>

          {/* Language Filter */}
          <div className="sm:col-span-3 flex items-center gap-1.5 bg-[#FBFBFE] border border-[#E9EAF1] rounded-xl px-2.5 py-1">
            <Globe className="w-3.5 h-3.5 text-[#858795] shrink-0" />
            <select
              value={selectedLangFilter}
              onChange={(e) => setSelectedLangFilter(e.target.value)}
              className="w-full bg-transparent text-xs text-[#20212B] focus:outline-none cursor-pointer py-1 capitalize"
            >
              <option value="all">All Languages</option>
              <option value="telugu">Telugu</option>
              <option value="hindi">Hindi</option>
              <option value="hinglish">Hinglish</option>
              <option value="kannada">Kannada</option>
              <option value="english">English</option>
            </select>
          </div>
        </div>

        {/* Mobile Cards for Human Review Annotations */}
        <div className="md:hidden space-y-2.5">
          {loading ? (
            [0, 1, 2].map(i => (
              <div key={i} className="h-24 bg-[#F8F9FE] border border-[#E9EAF1] rounded-xl animate-pulse" />
            ))
          ) : filteredList.length === 0 ? (
            <div className="py-10 text-center text-[#858795] text-xs rounded-xl border border-[#E9EAF1] bg-[#F8F9FE]">
              No human feedback records match the selected filters.
            </div>
          ) : (
            filteredList.map(item => (
              <div
                key={item.id}
                onClick={() => openInvestigation(item)}
                className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-2 cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-[#6C5CE7]">
                      #{(item.record_id || item.id).slice(0, 8)}
                    </span>
                    <span className="capitalize text-[10px] px-2 py-0.5 rounded-full bg-[#EEEAFE] border border-[#DDD6FE] font-semibold text-[#6C5CE7]">
                      {item.language || 'English'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-white text-[#858795] border border-[#E9EAF1]">
                      {item.platform || 'direct'}
                    </span>
                  </div>
                  {item.is_confirmed ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </span>
                  ) : item.is_false_positive ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                      <AlertOctagon className="w-3 h-3" /> False Pos.
                    </span>
                  ) : item.is_false_negative ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> False Neg.
                    </span>
                  ) : item.is_ambiguous ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] inline-flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> Ambiguous
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white text-[#858795] border border-[#E9EAF1]">
                      Pending
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium text-[#20212B] break-words line-clamp-2">
                  {item.comment_text || item.explanation || 'Direct sample'}
                </p>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-[#858795] tabular-nums">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openInvestigation(item);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-[11px] font-semibold inline-flex items-center gap-1"
                  >
                    <span>Investigate</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Scannable Desktop Case Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-[#E9EAF1]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5">Record ID</th>
                <th className="py-3 px-3">Comment Text</th>
                <th className="py-3 px-3">Language</th>
                <th className="py-3 px-3">Platform</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Reviewer Verdict</th>
                <th className="py-3 px-3">Human Review</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Explanation / Ground Truth</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F1F5]">
              {loading ? (
                [0, 1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={11} className="py-4 px-4 bg-[#F8F9FE]/40">
                      <div className="h-4 bg-[#E9EAF1] rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#858795] text-xs">
                    No human feedback records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredList.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F8F9FE] transition-colors group cursor-pointer"
                    onClick={() => openInvestigation(item)}
                  >
                    <td className="py-3 px-3.5 font-mono text-[#6C5CE7] font-semibold whitespace-nowrap">
                      {(item.record_id || item.id).slice(0, 8)}...
                    </td>
                    <td className="py-3 px-3 max-w-[200px] truncate text-[#20212B] font-medium" title={item.comment_text || item.explanation || ''}>
                      {item.comment_text || item.explanation || <span className="text-[#858795] italic">Direct sample</span>}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="capitalize text-[10px] px-2.5 py-0.5 rounded-full bg-[#EEEAFE] border border-[#DDD6FE] font-semibold text-[#6C5CE7]">
                        {item.language || 'English'}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                        {item.platform || 'direct'}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        item.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        item.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {item.severity || 'low'}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.is_confirmed ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      ) : item.is_false_positive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                          <AlertOctagon className="w-3 h-3" /> False Positive
                        </span>
                      ) : item.is_false_negative ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> False Negative
                        </span>
                      ) : item.is_ambiguous ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] inline-flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> Ambiguous
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap capitalize font-medium text-[#20212B]">
                      {item.human_review ? item.human_review.replace(/_/g, ' ') : (item.is_confirmed ? 'Approved' : 'Audited')}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize border ${
                        item.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.status === 'flagged' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-[#F5F6FA] text-[#858795] border-[#E9EAF1]'
                      }`}>
                        {item.status || 'reviewed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#20212B] max-w-xs truncate" title={item.explanation || ''}>
                      {item.explanation ? `"${item.explanation}"` : <span className="text-[#858795] italic">No notes provided</span>}
                    </td>
                    <td className="py-3 px-3 text-[#858795] text-[11px] tabular-nums whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openInvestigation(item);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                      >
                        <span>Investigate</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION D: SLIDE-OVER INVESTIGATION DRAWER
          ═══════════════════════════════════════════════════════════════════════ */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white border-l border-[#E9EAF1] h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto slide-in-right">
            
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E9EAF1]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7]">
                    <ShieldAlert className="w-4 h-4 text-[#6C5CE7]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#20212B]">Case Investigation Panel</h3>
                    <p className="text-[11px] text-[#858795] font-mono">
                      ID: {selectedItem.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 rounded-lg text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Original Target Comment Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#20212B]">
                    Original Comment Content
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                      {selectedItem.platform || 'Direct'}
                    </span>
                    <span className="capitalize text-[10px] px-2 py-0.5 rounded-full bg-[#EEEAFE] border border-[#DDD6FE] font-bold text-[#6C5CE7]">
                      {selectedItem.language || 'English'}
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-xs text-[#20212B] font-medium leading-relaxed max-h-40 overflow-y-auto break-words select-text shadow-inner">
                  "{selectedItem.comment_text || selectedItem.explanation || 'No comment text recorded'}"
                </div>
              </div>

              {/* Status & Decision Badges Strip */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  selectedItem.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  selectedItem.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Severity: {selectedItem.severity || 'low'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-[#E9EAF1] text-[#858795] capitalize">
                  Decision: {(selectedItem.decision || selectedItem.status || 'no action').replace(/_/g, ' ')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                  Status: {selectedItem.validation_status || selectedItem.status || 'reviewed'}
                </span>
                {selectedItem.created_at && (
                  <span className="text-[10px] text-[#858795] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#858795]" />
                    {new Date(selectedItem.created_at).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Category Scores Breakdown with Visual Bars */}
              <div className="p-3.5 bg-[#FBFBFE] rounded-xl border border-[#E9EAF1] space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#858795]">
                  <span>Model Category Scores</span>
                  <span className="text-[10px] text-[#6C5CE7] lowercase font-semibold">calibrated multi-category</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { label: 'Hate Speech', score: selectedItem.hate_speech_score ?? 0.0, isHarm: (selectedItem.hate_speech_score ?? 0) >= 0.4 },
                    { label: 'Harassment', score: selectedItem.harassment_score ?? 0.0, isHarm: (selectedItem.harassment_score ?? 0) >= 0.4 },
                    { label: 'Cyberbullying', score: selectedItem.cyberbullying_score ?? 0.0, isHarm: (selectedItem.cyberbullying_score ?? 0) >= 0.4 },
                    { label: 'Legitimate', score: selectedItem.legitimate_score ?? 0.0, isHarm: false },
                  ].map((cat) => {
                    const pct = Math.round((cat.score || 0) * 100);
                    return (
                      <div key={cat.label} className="p-2 bg-white rounded-lg border border-[#E9EAF1] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[#858795] text-[10px] font-medium">{cat.label}:</span>
                          <span className={`font-mono font-bold ${cat.isHarm ? 'text-rose-600' : 'text-[#20212B]'}`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#F0F1F5] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              cat.label === 'Legitimate' ? 'bg-emerald-500' : cat.isHarm ? 'bg-rose-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reviewer Notes / Historical Ground Truth */}
              {selectedItem.explanation && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#20212B]">
                    Logged Reviewer Notes &amp; Rationale
                  </span>
                  <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1] text-xs text-[#20212B] leading-relaxed max-h-24 overflow-y-auto">
                    "{selectedItem.explanation}"
                  </div>
                </div>
              )}

              {/* Case Metadata Strip */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1]">
                  <span className="text-[10px] uppercase font-semibold text-[#858795] block">Language Domain</span>
                  <span className="font-bold text-[#20212B] capitalize mt-0.5 block">{selectedItem.language || 'English'}</span>
                </div>
                <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1]">
                  <span className="text-[10px] uppercase font-semibold text-[#858795] block">Model Pipeline</span>
                  <span className="font-mono text-[#6C5CE7] text-[11px] font-semibold mt-0.5 block">{selectedItem.model_version || 'v1.0.0'}</span>
                </div>
              </div>

              {/* Linked Record Details */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#20212B]">
                  Linked Record Reference
                </label>
                <div className="p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] font-mono text-[11px] text-[#20212B] flex items-center justify-between">
                  <span className="truncate">{selectedItem.record_id || selectedItem.id}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedItem.record_id || selectedItem.id);
                      addToast('Copied record reference ID to clipboard', 'info');
                    }}
                    className="p-1 rounded hover:bg-[#E9EAF1] text-[#858795] hover:text-[#20212B]"
                    title="Copy ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Decision Workflow Controls */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#20212B] flex items-center justify-between">
                  <span>Human Ground Truth Decision</span>
                  <span className="text-[10px] text-[#6C5CE7] normal-case">Select to re-classify</span>
                </label>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setDrawerDecision('correct')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                      drawerDecision === 'correct'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700 shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Confirm Correct</span>
                  </button>

                  <button
                    onClick={() => setDrawerDecision('false_positive')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                      drawerDecision === 'false_positive'
                        ? 'bg-amber-50 border-amber-600 text-amber-700 shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>False Positive</span>
                  </button>

                  <button
                    onClick={() => setDrawerDecision('false_negative')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                      drawerDecision === 'false_negative'
                        ? 'bg-rose-50 border-rose-600 text-rose-700 shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>False Negative</span>
                  </button>

                  <button
                    onClick={() => setDrawerDecision('ambiguous')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all ${
                      drawerDecision === 'ambiguous'
                        ? 'bg-[#EEEAFE] border-[#6C5CE7] text-[#6C5CE7] shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-[#6C5CE7] shrink-0" />
                    <span>Ambiguous Case</span>
                  </button>
                </div>
              </div>

              {/* Reviewer Explanation / Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#20212B]">
                  Reviewer Rationale &amp; Notes
                </label>
                <textarea
                  rows={3}
                  value={drawerExplanation}
                  onChange={(e) => setDrawerExplanation(e.target.value)}
                  placeholder="Describe linguistic nuances, sarcasm, slang, or justification for this verdict..."
                  className="w-full p-3 bg-[#FBFBFE] border border-[#E9EAF1] rounded-xl text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-[#6C5CE7] transition-colors"
                />
              </div>

            </div>

            {/* Drawer Action Bar */}
            <div className="pt-4 border-t border-[#E9EAF1] flex items-center gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#F5F6FA] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#20212B] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDecision}
                disabled={isUpdatingDecision || !drawerDecision}
                className="flex-1 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdatingDecision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isUpdatingDecision ? 'Saving...' : 'Save Decision'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
