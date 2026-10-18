"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional, Any
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
    platform: Optional[str]
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
    pending_review: int
    high_priority: int
    today_analyzed: int
    model_name: str
    model_version: str
    model_type: str
    model_status: str
    is_demo: bool


class DistributionSchema(BaseModel):
    severity_distribution: dict[str, int]
    category_distribution: dict[str, int]
    language_distribution: dict[str, int]


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
