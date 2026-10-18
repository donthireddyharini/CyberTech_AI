import axios from 'axios';
import type {
  AnalyzeRequest, AnalyzeResponse, CompareContextResponse,
  DashboardSummary, DistributionData, ModerationListResponse,
  ModerationDetail, ReviewDecisionRequest, ModelStatus,
  EvaluationRun, Dataset, DatasetValidation, FeedbackRecord,
  ErrorAnalysis, RecentActivity
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    return Promise.reject(new Error(typeof message === 'string' ? message : JSON.stringify(message)));
  }
);

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
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  distributions: () => api.get<DistributionData>('/dashboard/distributions'),
  recent: (limit = 10) => api.get<RecentActivity[]>(`/dashboard/recent?limit=${limit}`),
  reviewQueue: (limit = 10) => api.get<RecentActivity[]>(`/dashboard/review-queue?limit=${limit}`),
};

// ─── Moderation ───────────────────────────────────────────────────────────────
export const moderationApi = {
  list: (params: {
    page?: number; page_size?: number; status?: string; severity?: string;
    language?: string; search?: string; sort_by?: string; sort_order?: string;
  }) => api.get<ModerationListResponse>('/moderation', { params }),
  getDetail: (id: string) => api.get<ModerationDetail>(`/moderation/${id}`),
  submitDecision: (id: string, data: ReviewDecisionRequest) =>
    api.post(`/moderation/${id}/decision`, data),
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
};

// ─── Evaluation ───────────────────────────────────────────────────────────────
export const evaluationApi = {
  list: () => api.get<EvaluationRun[]>('/evaluations'),
  get: (id: string) => api.get<EvaluationRun>(`/evaluations/${id}`),
  run: () => api.post('/evaluations/run'),
};

// ─── Datasets ─────────────────────────────────────────────────────────────────
export const datasetApi = {
  list: () => api.get<Dataset[]>('/datasets'),
  validate: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<DatasetValidation>('/datasets/validate', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  import: (file: File, meta: {
    name: string; version?: string; source?: string;
    license_info?: string; train_ratio?: number; val_ratio?: number; test_ratio?: number;
  }) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta).forEach(([k, v]) => v !== undefined && form.append(k, String(v)));
    return api.post('/datasets/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
