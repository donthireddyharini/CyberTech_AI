// TypeScript types for CyberTech AI

export interface LabelScore {
  label: string;
  score: number;
  evidence: string[];
}

export interface ToxicityPrediction {
  is_toxic: boolean;
  toxicity_score: number;
  confidence: number;
  threshold: number;
  model_version: string;
  model_available: boolean;
  scope_notice: string;
}

export interface LanguageRoute {
  status: 'validated_model' | 'needs_review' | 'unsupported_language_model';
  target_language: string;
  model_name: string;
  model_type: string;
  review_status: 'automated_pass_or_flag' | 'mandatory_human_review';
  notice: string;
}

export interface AnalyzeResponse {
  id: string;
  text: string;
  original_text: string;
  labels: LabelScore[];
  severity: 'low' | 'medium' | 'high' | 'uncertain';
  severity_reason: string;
  decision: string;
  confidence_level: string;
  detected_language: string;
  is_code_mixed: boolean;
  model_name: string;
  model_version: string;
  inference_timestamp: number;
  processing_time_ms: number;
  ambiguity_warning: string | null;
  recommended_action: string;
  model_type_note: string;
  toxicity_prediction?: ToxicityPrediction | null;
  language_route?: LanguageRoute | null;
}

export interface AnalyzeRequest {
  text: string;
  context_before?: string;
  context_after?: string;
  language_hint?: string;
  platform?: string;
}

export interface CompareContextResponse {
  without_context: AnalyzeResponse;
  with_context: AnalyzeResponse;
  label_changes: Record<string, { without_context: number; with_context: number; delta: number }>;
  severity_changed: boolean;
  decision_changed: boolean;
  note: string;
}

export interface ScoreDiffItem {
  text1: number;
  text2: number;
  diff: number;
}

export interface CompareTextsRequest {
  text1: string;
  text2: string;
  language_hint1?: string;
  language_hint2?: string;
}

export interface CompareTextsResponse {
  text1_analysis: AnalyzeResponse;
  text2_analysis: AnalyzeResponse;
  score_differences: Record<string, ScoreDiffItem>;
  toxicity_difference?: ScoreDiffItem | null;
  predictions_differ: boolean;
  relative_harm_assessment: string;
  comparability_notice: string;
  limitations: string[];
}

export interface ChatMessage {
  id: string;
  text: string;
  language_hint?: string;
  platform?: string;
  timestamp: string;
  result: AnalyzeResponse;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  user_id?: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail {
  id: string;
  title: string;
  user_id?: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_analyzed: number;
  flagged_comments: number;
  non_flagged_comments?: number;
  pending_review: number;
  high_priority: number;
  today_analyzed: number;
  violation_rate?: number;
  clean_rate?: number;
  completed_dataset_runs?: number;
  dataset_samples_processed?: number;
  model_name: string;
  model_version: string;
  model_type: string;
  model_status: string;
  is_demo: boolean;
}

export interface DatasetRun {
  id: string;
  dataset_name: string;
  dataset_id?: string | null;
  status: string;
  total_samples: number;
  processed_count: number;
  failed_count: number;
  flagged_count: number;
  approved_count: number;
  language_breakdown?: Record<string, number> | null;
  severity_breakdown?: Record<string, number> | null;
  processing_time_ms: number;
  created_at: string;
}

export interface DistributionData {
  severity_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  language_distribution: Record<string, number>;
  platform_distribution?: Record<string, number>;
}

export interface ModerationRecord {
  id: string;
  original_text: string;
  severity: string;
  decision: string;
  status: string;
  detected_language: string;
  hate_speech_score: number;
  harassment_score: number;
  cyberbullying_score: number;
  legitimate_score: number;
  model_name: string;
  model_version: string;
  platform: string | null;
  source_id?: string | null;
  source_url?: string | null;
  author_name?: string | null;
  parent_comment_id?: string | null;
  is_demo: boolean;
  is_code_mixed: boolean;
  created_at: string;
  ambiguity_warning: string | null;
  recommended_action: string | null;
}

export interface ModerationDetail extends ModerationRecord {
  normalized_text: string | null;
  context_before: string | null;
  context_after: string | null;
  labels: LabelScore[];
  severity_reason: string | null;
  confidence_level: string | null;
  language_hint: string | null;
  inference_timestamp: number | null;
  processing_time_ms: number | null;
  reviews: HumanReview[];
}

export interface HumanReview {
  id: string;
  action: string;
  corrected_labels: Record<string, unknown> | null;
  corrected_severity: string | null;
  reviewer_notes: string | null;
  override_reason: string | null;
  reviewer_id: string;
  reviewer_name: string;
  created_at: string;
}

export interface ModerationListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: ModerationRecord[];
}

export interface ReviewDecisionRequest {
  action: 'approve' | 'dismiss' | 'escalate' | 'further_review';
  corrected_labels?: Record<string, unknown>;
  corrected_severity?: string;
  reviewer_notes?: string;
  override_reason?: string;
  reviewer_id?: string;
  reviewer_name?: string;
}

export interface ModelStatus {
  status: string;
  model_name: string;
  model_version: string;
  model_type: string;
  is_trained: boolean;
  training_data_available: boolean;
  limitations: string[];
  capabilities: string[];
}

export interface EvaluationRun {
  id: string;
  run_name: string;
  model_name: string;
  model_version: string;
  dataset_name: string | null;
  total_samples: number;
  overall_metrics: Record<string, unknown> | null;
  per_label_metrics: Record<string, unknown> | null;
  per_language_metrics: Record<string, unknown> | null;
  confusion_matrix?: {
    true_negatives?: number;
    false_positives?: number;
    false_negatives?: number;
    true_positives?: number;
    raw_matrix?: number[][];
  } | null;
  status: string;
  created_at: string;
  notes: string | null;
}

export interface Dataset {
  id: string;
  name: string;
  version: string;
  source: string | null;
  total_records: number;
  train_count: number;
  val_count: number;
  test_count: number;
  label_distribution: Record<string, number> | null;
  language_distribution: Record<string, number> | null;
  status: string;
  license_info: string | null;
  created_at: string;
}

export interface DatasetValidation {
  valid: boolean;
  total_rows: number;
  missing_values: number;
  duplicate_count: number;
  label_distribution: Record<string, number>;
  language_distribution: Record<string, number>;
  platform_distribution?: Record<string, number>;
  errors: string[];
  warnings: string[];
  preview: Record<string, string>[];
}

export interface FeedbackRecord {
  id: string;
  record_id: string | null;
  comment_text?: string | null;
  severity?: string | null;
  platform?: string | null;
  human_review?: string | null;
  status?: string | null;
  is_false_positive: boolean;
  is_false_negative: boolean;
  is_ambiguous: boolean;
  is_confirmed: boolean;
  language: string | null;
  model_version: string | null;
  validation_status: string;
  explanation: string | null;
  decision?: string | null;
  hate_speech_score?: number | null;
  harassment_score?: number | null;
  cyberbullying_score?: number | null;
  legitimate_score?: number | null;
  created_at: string;
}

export interface SourceReportRecord {
  id: string;
  comment_text: string;
  source: string;
  detected_language: string;
  model_prediction: string;
  category_scores: {
    hate_speech: number;
    harassment: number;
    cyberbullying: number;
    legitimate: number;
  };
  operational_severity: string;
  moderation_decision: string;
  analysis_timestamp: string | null;
}

export interface SourceReportResponse {
  source: string;
  total_records: number;
  flagged_count: number;
  approved_count: number;
  records: SourceReportRecord[];
  message: string;
}

export interface ErrorAnalysis {
  total_feedback: number;
  false_positives: number;
  false_negatives: number;
  ambiguous: number;
  confirmed: number;
  fp_rate: number;
  fn_rate: number;
  by_language: Record<string, { total: number; fp: number; fn: number; ambiguous: number }>;
  by_model_version: Record<string, { total: number; fp: number; fn: number }>;
  pending_validation: number;
}

export interface RecentActivity {
  id: string;
  text_preview: string;
  severity: string;
  decision: string;
  status: string;
  detected_language: string;
  hate_speech_score: number;
  harassment_score: number;
  cyberbullying_score: number;
  platform?: string | null;
  source_url?: string | null;
  author_name?: string | null;
  source_id?: string | null;
  is_demo: boolean;
  created_at: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  preferred_language: string;
  role: string;
  auth_provider?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface GoogleLoginRequest {
  credential: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  preferred_language?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name?: string;
  preferred_language?: string;
}

// ─── Social Media Intelligence Types ─────────────────────────────────────────

export interface SocialConnectorStatus {
  platform: 'youtube' | 'instagram' | string;
  is_configured: boolean;
  status: 'ready' | 'unconfigured' | 'rate_limited' | 'credits_depleted' | 'error';
  message: string;
  last_sync_timestamp?: string | null;
  account_info?: string | null;
  rate_limit_info?: Record<string, unknown> | null;
}

export interface SocialSyncLog {
  id: string;
  platform: string;
  target_input: string;
  total_fetched: number;
  newly_ingested: number;
  duplicate_count: number;
  flagged_count: number;
  approved_count: number;
  status: string;
  error_message?: string | null;
  processing_time_ms: number;
  created_at: string;
}

export interface SocialStats {
  platforms: Record<string, { total: number; flagged: number; approved: number }>;
  total_social_records: number;
}

export interface SocialIngestionResult {
  sync_id: string;
  platform: string;
  target_input: string;
  requested_count?: number;
  total_fetched: number;
  newly_ingested: number;
  duplicate_count: number;
  failed_count?: number;
  flagged_count: number;
  approved_count: number;
  records: Array<{
    id: string;
    comment_id: string;
    text: string;
    author_name?: string | null;
    source_url?: string | null;
    parent_id?: string | null;
    severity: string;
    decision: string;
    detected_language: string;
    toxicity_score: number | null;
    is_flagged: boolean;
    published_at: string;
  }>;
  processing_time_ms: number;
  metadata?: Record<string, unknown>;
}
