import axios from 'axios';
import type {
  AnalyzeRequest, AnalyzeResponse, CompareContextResponse, CompareTextsRequest, CompareTextsResponse,
  ChatMessage, ChatSessionSummary, ChatSessionDetail,
  DashboardSummary, DistributionData, ModerationListResponse,
  ModerationDetail, ReviewDecisionRequest, ModelStatus,
  EvaluationRun, Dataset, DatasetValidation, FeedbackRecord,
  ErrorAnalysis, RecentActivity, User, AuthResponse,
  RegisterRequest, LoginRequest, UpdateProfileRequest,
  SocialConnectorStatus, SocialSyncLog, SocialStats, SocialIngestionResult,
  SourceReportResponse
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to all requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sentinel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('sentinel_token');
      localStorage.removeItem('sentinel_user');
    }
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    return Promise.reject(new Error(typeof message === 'string' ? message : JSON.stringify(message)));
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
  googleLogin: (credential: string) => api.post<AuthResponse>('/auth/google', { credential }),
  googleDemoLogin: () => api.post<AuthResponse>('/auth/google/demo'),
  getOAuthConfig: () => api.get<{ google_enabled: boolean; client_id_configured: boolean; client_id: string | null }>('/auth/oauth-config'),
  me: () => api.get<User>('/auth/me'),
  updateProfile: (data: UpdateProfileRequest) => api.put<User>('/auth/profile', data),
  logout: () => api.post<{ message: string }>('/auth/logout'),
};

// ─── Health ──────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get<{ status: string; version: string }>('/health'),
  modelStatus: () => api.get<ModelStatus>('/model/status'),
};

// ─── Analysis ────────────────────────────────────────────────────────────────
export const analyzeApi = {
  analyze: (request: AnalyzeRequest) => api.post<AnalyzeResponse>('/analyze', request),
  compareContext: (request: { text: string; context_before?: string; context_after?: string }) =>
    api.post<CompareContextResponse>('/analyze/compare-context', request),
  compareTexts: (request: CompareTextsRequest) =>
    api.post<CompareTextsResponse>('/analyze/compare-texts', request),
  listSessions: () => api.get<ChatSessionSummary[]>('/analyze/sessions'),
  createSession: (title?: string) => api.post<ChatSessionDetail>('/analyze/sessions', { title }),
  getSession: (id: string) => api.get<ChatSessionDetail>(`/analyze/sessions/${id}`),
  addMessage: (sessionId: string, data: { text: string; language_hint?: string; platform?: string; result: AnalyzeResponse }) =>
    api.post<ChatSessionDetail>(`/analyze/sessions/${sessionId}/messages`, data),
  deleteSession: (id: string) => api.delete<{ status: string; id: string }>(`/analyze/sessions/${id}`),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: (timeframe?: string, startDate?: string, endDate?: string, platform?: string) =>
    api.get<DashboardSummary>('/dashboard/summary', {
      params: { timeframe, time_range: timeframe, start_date: startDate, end_date: endDate, platform }
    }),
  distributions: (timeframe?: string, startDate?: string, endDate?: string, platform?: string) =>
    api.get<DistributionData>('/dashboard/distributions', {
      params: { timeframe, time_range: timeframe, start_date: startDate, end_date: endDate, platform }
    }),
  recent: (limit = 10, timeframe?: string, startDate?: string, endDate?: string, platform?: string) =>
    api.get<RecentActivity[]>('/dashboard/recent', {
      params: { limit, timeframe, time_range: timeframe, start_date: startDate, end_date: endDate, platform }
    }),
  timeline: (days = 7, timeframe?: string, startDate?: string, endDate?: string, platform?: string) =>
    api.get<Array<{ date: string; total: number; flagged: number; approved: number }>>('/dashboard/timeline', {
      params: { days, timeframe, time_range: timeframe, start_date: startDate, end_date: endDate, platform }
    }),
  reviewQueue: (limit = 10, platform?: string) =>
    api.get<RecentActivity[]>('/dashboard/review-queue', { params: { limit, platform } }),
  datasetRuns: (limit = 5) => api.get<any[]>('/dashboard/dataset-runs', { params: { limit } }),
};

// ─── Moderation ───────────────────────────────────────────────────────────────
export const moderationApi = {
  list: (params: {
    page?: number; page_size?: number; status?: string; severity?: string;
    language?: string; decision?: string; platform?: string; search?: string;
    sort_by?: string; sort_order?: string;
  }) => api.get<ModerationListResponse>('/moderation', { params }),
  getDetail: (id: string) => api.get<ModerationDetail>(`/moderation/${id}`),
  submitDecision: (id: string, data: ReviewDecisionRequest) =>
    api.post(`/moderation/${id}/decision`, data),
};

// ─── Social Media Intelligence & Live Connectors ──────────────────────────────
export const socialApi = {
  getConnectors: () => api.get<SocialConnectorStatus[]>('/social/connectors'),
  fetchYouTube: (data: {
    video_input: string;
    max_comments?: number;
    include_replies?: boolean;
    order?: string;
  }) => api.post<SocialIngestionResult>('/social/youtube/fetch', data),
  fetchInstagram: (data: {
    media_input: string;
    max_comments?: number;
    include_replies?: boolean;
  }) => api.post<SocialIngestionResult>('/social/instagram/fetch', data),
  getSyncHistory: (platform?: string, limit = 50) =>
    api.get<SocialSyncLog[]>('/social/sync-history', { params: { platform, limit } }),
  getSyncDetail: (id: string) =>
    api.get<SocialSyncLog>(`/social/sync-history/${id}`),
  deleteSyncLog: (id: string) =>
    api.delete<{ status: string; id: string }>(`/social/sync-history/${id}`),
  getStats: () => api.get<SocialStats>('/social/stats'),
};

// ─── Feedback ─────────────────────────────────────────────────────────────────
export const feedbackApi = {
  submit: (data: {
    record_id?: string; is_false_positive?: boolean; is_false_negative?: boolean;
    is_ambiguous?: boolean; is_confirmed?: boolean; explanation?: string;
    language?: string; model_version?: string; predicted_labels?: Record<string, unknown>;
    corrected_labels?: Record<string, unknown>; predicted_severity?: string;
    corrected_severity?: string;
  }) => api.post<FeedbackRecord>('/feedback', data),
  list: (params?: { page?: number; validation_status?: string }) =>
    api.get('/feedback', { params }),
  errorAnalysis: () => api.get<ErrorAnalysis>('/feedback/errors'),
  exportUrl: (format: 'csv' | 'jsonl' = 'csv') => `/api/feedback/export?format=${format}`,
};

// ─── Real-Time Comment Monitoring ───────────────────────────────────────────
export const monitoringApi = {
  status: () => api.get<{
    monitoring_status: string;
    real_time_inference: boolean;
    api_keys_required: boolean;
    external_network_calls: boolean;
    active_model_name: string;
    active_threshold: number;
    total_monitored_records: number;
    flagged_records_count: number;
    pending_human_review_count: number;
    reviewed_records_count: number;
    last_processed_timestamp: string | null;
  }>('/monitor/status'),
  batchAnalyze: (data: {
    comments: string[];
    language_hint?: string;
    platform_source?: string;
    deduplicate?: boolean;
  }) => api.post<{
    monitoring_mode: string;
    platform_notice: string;
    total_received: number;
    processed_count: number;
    duplicate_count: number;
    flagged_count: number;
    approved_count: number;
    severity_breakdown: Record<string, number>;
    language_breakdown: Record<string, number>;
    processing_time_ms: number;
    items: Array<{
      id: string;
      text: string;
      toxicity_score: number | null;
      is_toxic: boolean;
      detected_language: string;
      severity: string;
      decision: string;
      review_status: string;
      model_version: string;
      processing_time_ms: number;
    }>;
  }>('/monitor/batch-analyze', data),
  uploadCsv: (
    file: File,
    deduplicate = true,
    platform_name = 'CSV Import',
    language_hint?: string,
    comment_column?: string,
    async_job = true
  ) => {
    const form = new FormData();
    form.append('file', file);
    form.append('deduplicate', String(deduplicate));
    form.append('platform_name', platform_name);
    if (language_hint) form.append('language_hint', language_hint);
    if (comment_column) form.append('comment_column', comment_column);
    form.append('async_job', String(async_job));
    return api.post('/monitor/upload-csv', form);
  },
  previewCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{
      filename: string;
      total_estimated_rows: number;
      delimiter: string;
      columns: string[];
      detected_column: string | null;
      preview_rows: Array<Record<string, string>>;
    }>('/monitor/preview-csv', form);
  },
  csvStatus: (jobId: string) =>
    api.get<{
      job_id: string;
      status: 'processing' | 'completed' | 'failed';
      filename: string;
      total_records: number;
      processed_count: number;
      duplicate_count: number;
      failed_count: number;
      flagged_count: number;
      approved_count: number;
      severity_breakdown: Record<string, number>;
      language_breakdown: Record<string, number>;
      progress_percent: number;
      processing_time_ms: number;
      items: Array<any>;
      error_message?: string | null;
      completed_at?: number | null;
    }>(`/monitor/csv-status/${jobId}`),
  exportUrl: (format: 'csv' | 'jsonl' = 'csv') => `/api/monitor/export-reviewed-feedback?format=${format}`,
};

// ─── Evaluation ───────────────────────────────────────────────────────────────
export const evaluationApi = {
  list: () => api.get<EvaluationRun[]>('/evaluations'),
  get: (id: string) => api.get<EvaluationRun>(`/evaluations/${id}`),
  run: () => api.post('/evaluations/run'),
  sourceReport: (source: string, timeframe?: string, startDate?: string, endDate?: string) =>
    api.get<SourceReportResponse>('/evaluations/report/source', {
      params: { source, timeframe, start_date: startDate, end_date: endDate }
    }),
  exportSourceReportUrl: (source: string, format = 'csv') =>
    `/api/evaluations/report/source/export?source=${encodeURIComponent(source)}&format=${encodeURIComponent(format)}`,
  downloadSourceReport: async (source: string, format = 'csv') => {
    const response = await api.get('/evaluations/report/source/export', {
      params: { source, format },
      responseType: 'blob',
    });
    const mime = format === 'json' ? 'application/json' : 'text/csv';
    const ext = format === 'json' ? 'json' : 'csv';
    const blob = new Blob([response.data], { type: mime });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CyberTech_AI_${source}_Report_${new Date().toISOString().slice(0, 10)}.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadPdf: async () => {
    const response = await api.get('/evaluations/report/pdf', {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CyberTech_AI_Research_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

// ─── Datasets ─────────────────────────────────────────────────────────────────
export const datasetApi = {
  list: () => api.get<Dataset[]>('/datasets'),
  runs: () => api.get<any[]>('/datasets/runs'),
  detect: (datasetId: string, sampleLimit = 50) =>
    api.post<{
      run_id: string;
      dataset_id: string;
      dataset_name: string;
      status: string;
      total_samples: number;
      processed_count: number;
      flagged_count: number;
      approved_count: number;
      language_breakdown: Record<string, number>;
      severity_breakdown: Record<string, number>;
      processing_time_ms: number;
      items: Array<any>;
    }>(`/datasets/${datasetId}/detect?sample_limit=${sampleLimit}`),
  validate: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<DatasetValidation>('/datasets/validate', form);
  },
  import: (file: File, meta: {
    name: string; version?: string; source?: string;
    license_info?: string; train_ratio?: number; val_ratio?: number; test_ratio?: number;
  }) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta).forEach(([k, v]) => v !== undefined && form.append(k, String(v)));
    return api.post('/datasets/import', form);
  },
};

// ─── Audit ────────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (params?: { page?: number; event_type?: string }) =>
    api.get('/audit', { params }),
};

// ─── Project ──────────────────────────────────────────────────────────────────
export const projectApi = {
  overview: () => api.get('/project/overview'),
};

export default api;
