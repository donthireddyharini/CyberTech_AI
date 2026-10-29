"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional, Any, Union
from pydantic import BaseModel, Field, field_validator


# ─── Analysis Schemas ────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="Comment text to analyze")
    context_before: Optional[str] = Field(None, max_length=5000, description="Previous message in conversation")
    context_after: Optional[str] = Field(None, max_length=5000, description="Reply or following message")
    language_hint: Optional[str] = Field(None, description="Manual language selection")
    platform: Optional[str] = Field(None, max_length=100, description="Source platform")

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be blank or whitespace only")
        return v


class LabelScoreSchema(BaseModel):
    label: str
    score: float
    evidence: list[str] = []


class ToxicityPredictionSchema(BaseModel):
    is_toxic: bool
    toxicity_score: float
    confidence: float
    threshold: float
    model_version: str
    model_available: bool = True
    scope_notice: str = "English toxicity baseline only. Not multilingual hate speech."


class LanguageRouteSchema(BaseModel):
    status: str = Field(..., description="validated_model | needs_review | unsupported_language_model")
    target_language: str
    model_name: str
    model_type: str
    review_status: str = Field(..., description="automated_pass_or_flag | mandatory_human_review")
    notice: str


class AnalyzeResponse(BaseModel):
    id: str
    text: str
    original_text: str
    labels: list[LabelScoreSchema]
    severity: str
    severity_reason: str
    decision: str
    confidence_level: str
    detected_language: str
    is_code_mixed: bool
    model_name: str
    model_version: str
    inference_timestamp: float
    processing_time_ms: float
    ambiguity_warning: Optional[str]
    recommended_action: str
    model_type_note: str = "rule_based_baseline — not a fine-tuned transformer"
    toxicity_prediction: Optional[ToxicityPredictionSchema] = None
    language_route: Optional[LanguageRouteSchema] = None


class CompareContextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    context_before: Optional[str] = Field(None, max_length=5000)
    context_after: Optional[str] = Field(None, max_length=5000)
    language_hint: Optional[str] = None


class CompareContextResponse(BaseModel):
    without_context: AnalyzeResponse
    with_context: AnalyzeResponse
    label_changes: dict[str, dict]
    severity_changed: bool
    decision_changed: bool
    note: str


class CompareTextsRequest(BaseModel):
    text1: str = Field(..., min_length=1, max_length=10000, description="First comment/message")
    text2: str = Field(..., min_length=1, max_length=10000, description="Second comment/message")
    language_hint1: Optional[str] = None
    language_hint2: Optional[str] = None

    @field_validator("text1", "text2")
    @classmethod
    def texts_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Input text must not be blank or whitespace only")
        return v


class ScoreDiffItem(BaseModel):
    text1: float
    text2: float
    diff: float


class CompareTextsResponse(BaseModel):
    text1_analysis: AnalyzeResponse
    text2_analysis: AnalyzeResponse
    score_differences: dict[str, ScoreDiffItem]
    toxicity_difference: Optional[ScoreDiffItem] = None
    predictions_differ: bool
    relative_harm_assessment: str
    comparability_notice: str
    limitations: list[str]


# ─── Context Intelligence Lab Chat Session Schemas ───────────────────────────

class ChatMessageSchema(BaseModel):
    id: str
    text: str
    language_hint: Optional[str] = None
    platform: Optional[str] = "manual"
    timestamp: str
    result: Union[AnalyzeResponse, dict[str, Any]]


class ChatSessionCreateRequest(BaseModel):
    title: Optional[str] = None


class ChatSessionSummarySchema(BaseModel):
    id: str
    title: str
    user_id: Optional[str] = None
    message_count: int = 0
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ChatSessionDetailSchema(BaseModel):
    id: str
    title: str
    user_id: Optional[str] = None
    messages: list[ChatMessageSchema] = []
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class AddChatMessageRequest(BaseModel):
    text: str
    language_hint: Optional[str] = None
    platform: Optional[str] = "manual"
    result: Union[AnalyzeResponse, dict[str, Any]]


# ─── Moderation Schemas ───────────────────────────────────────────────────────

class ModerationRecordSchema(BaseModel):
    id: str
    original_text: str
    severity: str
    decision: str
    status: str
    detected_language: Optional[str]
    hate_speech_score: float
    harassment_score: float
    cyberbullying_score: float
    legitimate_score: float
    model_name: str
    model_version: str
    platform: Optional[str] = None
    source_id: Optional[str] = None
    source_url: Optional[str] = None
    author_name: Optional[str] = None
    parent_comment_id: Optional[str] = None
    is_demo: bool
    created_at: datetime
    ambiguity_warning: Optional[str]
    recommended_action: Optional[str]

    model_config = {"from_attributes": True}


class ModerationDetailSchema(ModerationRecordSchema):
    normalized_text: Optional[str]
    context_before: Optional[str]
    context_after: Optional[str]
    labels: list[dict]
    severity_reason: Optional[str]
    confidence_level: Optional[str]
    is_code_mixed: bool
    language_hint: Optional[str]
    inference_timestamp: Optional[float]
    processing_time_ms: Optional[float]

    model_config = {"from_attributes": True}


class ReviewDecisionRequest(BaseModel):
    action: str = Field(..., description="approve|dismiss|escalate|further_review")
    corrected_labels: Optional[dict] = None
    corrected_severity: Optional[str] = None
    reviewer_notes: Optional[str] = None
    override_reason: Optional[str] = None
    reviewer_id: str = "moderator_1"
    reviewer_name: str = "Moderator"

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        allowed = {"approve", "dismiss", "escalate", "further_review"}
        if v not in allowed:
            raise ValueError(f"action must be one of {allowed}")
        return v


# ─── Dashboard Schemas ────────────────────────────────────────────────────────

class DashboardSummarySchema(BaseModel):
    total_analyzed: int
    flagged_comments: int
    non_flagged_comments: int = 0
    pending_review: int
    high_priority: int
    today_analyzed: int
    violation_rate: float = 0.0
    clean_rate: float = 0.0
    completed_dataset_runs: int = 0
    dataset_samples_processed: int = 0
    model_name: str
    model_version: str
    model_type: str
    model_status: str
    is_demo: bool


class DatasetRunSchema(BaseModel):
    id: str
    dataset_name: str
    dataset_id: Optional[str] = None
    status: str
    total_samples: int
    processed_count: int
    failed_count: int
    flagged_count: int
    approved_count: int
    language_breakdown: Optional[dict] = None
    severity_breakdown: Optional[dict] = None
    processing_time_ms: float
    created_at: str

    model_config = {"from_attributes": True}


class DistributionSchema(BaseModel):
    severity_distribution: dict[str, int]
    category_distribution: dict[str, int]
    language_distribution: dict[str, int]
    platform_distribution: Optional[dict[str, int]] = None


# ─── Feedback Schemas ─────────────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    record_id: Optional[str] = None
    predicted_labels: Optional[dict] = None
    corrected_labels: Optional[dict] = None
    predicted_severity: Optional[str] = None
    corrected_severity: Optional[str] = None
    is_false_positive: bool = False
    is_false_negative: bool = False
    is_ambiguous: bool = False
    is_confirmed: bool = False
    explanation: Optional[str] = None
    language: Optional[str] = None
    model_version: Optional[str] = None
    reviewer_id: str = "moderator_1"


class FeedbackSchema(BaseModel):
    id: str
    record_id: Optional[str]
    is_false_positive: bool
    is_false_negative: bool
    is_ambiguous: bool
    is_confirmed: bool
    language: Optional[str]
    model_version: Optional[str]
    validation_status: str
    created_at: datetime
    explanation: Optional[str]

    model_config = {"from_attributes": True}


class ErrorAnalysisSchema(BaseModel):
    total_feedback: int
    false_positives: int
    false_negatives: int
    ambiguous: int
    confirmed: int
    fp_rate: float
    fn_rate: float
    by_language: dict[str, dict]
    by_model_version: dict[str, dict]
    pending_validation: int


# ─── Evaluation Schemas ───────────────────────────────────────────────────────

class EvaluationRunSchema(BaseModel):
    id: str
    run_name: str
    model_name: str
    model_version: str
    dataset_name: Optional[str]
    total_samples: int
    overall_metrics: Optional[dict]
    per_label_metrics: Optional[dict]
    per_language_metrics: Optional[dict]
    confusion_matrix: Optional[dict] = None
    status: str
    created_at: datetime
    notes: Optional[str]

    model_config = {"from_attributes": True}


# ─── Dataset Schemas ──────────────────────────────────────────────────────────

class DatasetValidationResponse(BaseModel):
    valid: bool
    total_rows: int
    missing_values: int
    duplicate_count: int
    label_distribution: dict
    language_distribution: dict
    errors: list[str]
    warnings: list[str]
    preview: list[dict]


class DatasetImportRequest(BaseModel):
    name: str
    version: str = "1.0.0"
    source: Optional[str] = None
    license_info: Optional[str] = None
    permitted_use: Optional[str] = None
    train_ratio: float = Field(0.7, ge=0.0, le=1.0)
    val_ratio: float = Field(0.15, ge=0.0, le=1.0)
    test_ratio: float = Field(0.15, ge=0.0, le=1.0)


# ─── Model Status Schema ──────────────────────────────────────────────────────

class ModelStatusSchema(BaseModel):
    status: str  # ready / not_configured / error
    model_name: str
    model_version: str
    model_type: str
    is_trained: bool
    training_data_available: bool
    limitations: list[str]
    capabilities: list[str]


# ─── Auth & User Schemas ──────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=100)
    preferred_language: str = Field("en", max_length=20)


class UserLoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=10, description="Google ID Token JWT")


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    preferred_language: str
    auth_provider: str = "local"
    is_active: bool
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    preferred_language: Optional[str] = Field(None, max_length=20)
