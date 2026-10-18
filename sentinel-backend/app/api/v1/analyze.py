"""Analysis endpoints — the core NLP inference pipeline."""
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.nlp.engine import get_nlp_engine
from app.models.moderation import ModerationRecord
from app.schemas.schemas import (
    AnalyzeRequest, AnalyzeResponse, LabelScoreSchema, ToxicityPredictionSchema,
    LanguageRouteSchema, CompareContextRequest, CompareContextResponse
)

router = APIRouter()


def _result_to_schema(result, record_id: str) -> AnalyzeResponse:
    tox_schema = None
    if getattr(result, "toxicity_prediction", None):
        tp = result.toxicity_prediction
        tox_schema = ToxicityPredictionSchema(
            is_toxic=tp.is_toxic,
            toxicity_score=tp.toxicity_score,
            confidence=tp.confidence,
            threshold=tp.threshold,
            model_version=tp.model_version,
            model_available=tp.model_available,
            scope_notice=tp.scope_notice
        )

    route_schema = None
    if getattr(result, "language_route", None):
        lr = result.language_route
        route_schema = LanguageRouteSchema(
            status=lr.status,
            target_language=lr.target_language,
            model_name=lr.model_name,
            model_type=lr.model_type,
            review_status=lr.review_status,
            notice=lr.notice,
        )

    return AnalyzeResponse(
        id=record_id,
        text=result.text,
        original_text=result.original_text,
        labels=[LabelScoreSchema(label=l.label, score=l.score, evidence=l.evidence) for l in result.labels],
        severity=result.severity,
        severity_reason=result.severity_reason,
        decision=result.decision,
        confidence_level=result.confidence_level,
        detected_language=result.detected_language,
        is_code_mixed=result.is_code_mixed,
        model_name=result.model_name,
        model_version=result.model_version,
        inference_timestamp=result.inference_timestamp,
        processing_time_ms=result.processing_time_ms,
        ambiguity_warning=result.ambiguity_warning,
        recommended_action=result.recommended_action,
        toxicity_prediction=tox_schema,
        language_route=route_schema,
    )


@router.post("", response_model=AnalyzeResponse)
async def analyze_text(request: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """Analyze a comment using the configured NLP engine."""
    engine = get_nlp_engine()
    try:
        result = engine.analyze(
            text=request.text,
            context_before=request.context_before,
            context_after=request.context_after,
            language_hint=request.language_hint,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

    record_id = str(uuid.uuid4())
    record = ModerationRecord(
        id=record_id,
        original_text=result.original_text,
        normalized_text=result.text,
        context_before=request.context_before,
        context_after=request.context_after,
        model_name=result.model_name,
        model_version=result.model_version,
        labels=[{"label": l.label, "score": l.score, "evidence": l.evidence} for l in result.labels],
        hate_speech_score=next((l.score for l in result.labels if l.label == "hate_speech"), 0.0),
        harassment_score=next((l.score for l in result.labels if l.label == "harassment"), 0.0),
        cyberbullying_score=next((l.score for l in result.labels if l.label == "cyberbullying"), 0.0),
        legitimate_score=next((l.score for l in result.labels if l.label == "legitimate"), 0.0),
        severity=result.severity,
        severity_reason=result.severity_reason,
        decision=result.decision,
        confidence_level=result.confidence_level,
        recommended_action=result.recommended_action,
        ambiguity_warning=result.ambiguity_warning,
        detected_language=result.detected_language,
        is_code_mixed=result.is_code_mixed,
        language_hint=request.language_hint,
        status="pending" if result.decision != "no_action" else "reviewed",
        platform=request.platform,
        is_demo=False,
        inference_timestamp=result.inference_timestamp,
        processing_time_ms=result.processing_time_ms,
    )
    db.add(record)
    await db.commit()

    return _result_to_schema(result, record_id)


@router.post("/compare-context", response_model=CompareContextResponse)
async def compare_context(request: CompareContextRequest, db: AsyncSession = Depends(get_db)):
    """Compare analysis with and without conversation context."""
    engine = get_nlp_engine()
    try:
        result_no_ctx = engine.analyze(
            text=request.text,
            context_before=None,
            context_after=None,
            language_hint=request.language_hint,
        )
        result_with_ctx = engine.analyze(
            text=request.text,
            context_before=request.context_before,
            context_after=request.context_after,
            language_hint=request.language_hint,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    id1 = str(uuid.uuid4())
    id2 = str(uuid.uuid4())

    no_ctx_schema = _result_to_schema(result_no_ctx, id1)
    with_ctx_schema = _result_to_schema(result_with_ctx, id2)

    # Compute label changes
    no_ctx_scores = {l.label: l.score for l in result_no_ctx.labels}
    with_ctx_scores = {l.label: l.score for l in result_with_ctx.labels}
    label_changes = {}
    for label in no_ctx_scores:
        delta = round(with_ctx_scores.get(label, 0.0) - no_ctx_scores[label], 3)
        label_changes[label] = {
            "without_context": no_ctx_scores[label],
            "with_context": with_ctx_scores.get(label, 0.0),
            "delta": delta,
        }

    return CompareContextResponse(
        without_context=no_ctx_schema,
        with_context=with_ctx_schema,
        label_changes=label_changes,
        severity_changed=result_no_ctx.severity != result_with_ctx.severity,
        decision_changed=result_no_ctx.decision != result_with_ctx.decision,
        note=(
            "Both inference runs were genuinely performed. Context inclusion may shift scores "
            "based on additional text patterns. This does NOT guarantee accurate intent interpretation. "
            "Human review is recommended for ambiguous cases."
        ),
    )
