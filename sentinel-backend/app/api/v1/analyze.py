"""Analysis endpoints — the core NLP inference pipeline."""
import uuid
import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.nlp.engine import get_nlp_engine
from app.api.v1.auth import get_current_user_optional
from app.models.user import User
from app.models.moderation import ModerationRecord
from app.models.chat_session import ChatSession
from app.schemas.schemas import (
    AnalyzeRequest, AnalyzeResponse, LabelScoreSchema, ToxicityPredictionSchema,
    LanguageRouteSchema, CompareContextRequest, CompareContextResponse,
    CompareTextsRequest, CompareTextsResponse, ScoreDiffItem,
    ChatSessionCreateRequest, ChatSessionSummarySchema, ChatSessionDetailSchema,
    AddChatMessageRequest
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
async def analyze_text(
    request: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
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
        user_id=current_user.id if current_user else None,
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



@router.post("/compare-texts", response_model=CompareTextsResponse)
async def compare_texts(request: CompareTextsRequest):
    """
    Perform real comparative inference on two user-provided texts.
    Analyzes both texts independently using the appropriate language detection and ML pipelines.
    Computes differences in category scores and toxicity, and evaluates relative harm
    while acknowledging language/calibration limitations.
    """
    engine = get_nlp_engine()
    try:
        res1 = engine.analyze(text=request.text1, language_hint=request.language_hint1)
        res2 = engine.analyze(text=request.text2, language_hint=request.language_hint2)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparative inference failed: {str(e)}")

    id1 = str(uuid.uuid4())
    id2 = str(uuid.uuid4())
    schema1 = _result_to_schema(res1, id1)
    schema2 = _result_to_schema(res2, id2)

    # Category score differences
    labels1 = {l.label: l.score for l in res1.labels}
    labels2 = {l.label: l.score for l in res2.labels}
    all_labels = ["hate_speech", "harassment", "cyberbullying", "legitimate"]

    score_diffs: dict[str, ScoreDiffItem] = {}
    for lbl in all_labels:
        s1 = round(labels1.get(lbl, 0.0), 3)
        s2 = round(labels2.get(lbl, 0.0), 3)
        score_diffs[lbl] = ScoreDiffItem(text1=s1, text2=s2, diff=round(s2 - s1, 3))

    # Toxicity differences
    tox_diff = None
    if getattr(res1, "toxicity_prediction", None) and getattr(res2, "toxicity_prediction", None):
        t1 = round(res1.toxicity_prediction.toxicity_score, 4)
        t2 = round(res2.toxicity_prediction.toxicity_score, 4)
        tox_diff = ScoreDiffItem(text1=t1, text2=t2, diff=round(t2 - t1, 4))
        score_diffs["toxicity"] = tox_diff

    # Determine predictions differ
    predictions_differ = (
        res1.severity != res2.severity
        or res1.decision != res2.decision
        or (tox_diff is not None and abs(tox_diff.diff) >= 0.05)
    )

    # Comparative harm evaluation with grounding
    lang1 = res1.detected_language or "unknown"
    lang2 = res2.detected_language or "unknown"
    same_lang = (lang1 == lang2)

    limitations: list[str] = [
        "Model scores reflect decision-boundary activation rather than absolute objective truth; borderline content near threshold requires moderator oversight.",
        "Zero Cloud LLM inference: all detections are performed strictly on local scikit-learn models without generative context extrapolation.",
    ]
    if not same_lang:
        limitations.append(
            f"Cross-lingual comparison ({lang1} vs {lang2}): Different calibrated language models were routed. "
            "Probability scales are not directly interchangeable across different language models."
        )

    # Harm assessment
    sev_rank = {"low": 1, "uncertain": 2, "medium": 3, "high": 4}
    rank1 = sev_rank.get(res1.severity, 1)
    rank2 = sev_rank.get(res2.severity, 1)

    if rank1 > rank2:
        relative_harm = "Text 1 appears more harmful based on higher operational severity classification."
    elif rank2 > rank1:
        relative_harm = "Text 2 appears more harmful based on higher operational severity classification."
    else:
        # Same severity
        if tox_diff and abs(tox_diff.diff) >= 0.10:
            if tox_diff.diff > 0:
                relative_harm = (
                    "Both share the same operational severity level, but Text 2 displays a higher toxicity score."
                    if same_lang else
                    "Both share the same severity band; Text 2 has a higher raw score, but cross-script comparison is subject to calibration divergence."
                )
            else:
                relative_harm = (
                    "Both share the same operational severity level, but Text 1 displays a higher toxicity score."
                    if same_lang else
                    "Both share the same severity band; Text 1 has a higher raw score, but cross-script comparison is subject to calibration divergence."
                )
        elif res1.decision == "no_action" and res2.decision == "no_action":
            relative_harm = "Both texts are classified as benign / civil discourse with no policy violations detected."
        elif res1.decision == res2.decision:
            relative_harm = f"Both texts receive equivalent operational action ('{res1.decision}') and severity ('{res1.severity}')."
        else:
            relative_harm = f"Mixed signals: Text 1 decision is '{res1.decision}', whereas Text 2 decision is '{res2.decision}'."

    comparability_notice = (
        "Inference executed on both inputs independently via local scikit-learn models. "
        + ("Direct calibrated comparison valid (same language model)." if same_lang else
           "Cross-language comparison: probability distributions reflect distinct language baseline thresholds.")
    )

    return CompareTextsResponse(
        text1_analysis=schema1,
        text2_analysis=schema2,
        score_differences=score_diffs,
        toxicity_difference=tox_diff,
        predictions_differ=predictions_differ,
        relative_harm_assessment=relative_harm,
        comparability_notice=comparability_notice,
        limitations=limitations,
    )


# ─── Context Intelligence Lab Chat Sessions ──────────────────────────────────

@router.get("/sessions", response_model=list[ChatSessionSummarySchema])
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """List manual-analysis chat sessions for authenticated user or anonymous workspace."""
    conditions = []
    if current_user:
        conditions.append(or_(ChatSession.user_id == current_user.id, ChatSession.user_id.is_(None)))
    else:
        conditions.append(ChatSession.user_id.is_(None))

    stmt = select(ChatSession).where(and_(*conditions)).order_by(ChatSession.updated_at.desc())
    res = await db.execute(stmt)
    sessions = res.scalars().all()

    return [
        ChatSessionSummarySchema(
            id=s.id,
            title=s.title,
            user_id=s.user_id,
            message_count=len(s.messages) if s.messages else 0,
            created_at=s.created_at.isoformat() if s.created_at else datetime.utcnow().isoformat(),
            updated_at=s.updated_at.isoformat() if s.updated_at else datetime.utcnow().isoformat(),
        )
        for s in sessions
    ]


@router.post("/sessions", response_model=ChatSessionDetailSchema)
async def create_chat_session(
    request: Optional[ChatSessionCreateRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Create a new manual-analysis chat session."""
    session_id = str(uuid.uuid4())
    title = (request.title if request and request.title else None) or "New Intelligence Session"
    session = ChatSession(
        id=session_id,
        title=title,
        user_id=current_user.id if current_user else None,
        messages=[],
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return ChatSessionDetailSchema(
        id=session.id,
        title=session.title,
        user_id=session.user_id,
        messages=[],
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailSchema)
async def get_chat_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve a specific chat session with its full transcript."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return ChatSessionDetailSchema(
        id=session.id,
        title=session.title,
        user_id=session.user_id,
        messages=session.messages or [],
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.post("/sessions/{session_id}/messages", response_model=ChatSessionDetailSchema)
async def add_chat_message(session_id: str, request: AddChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """Append a message to a chat session."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        session = ChatSession(
            id=session_id,
            title=request.text[:40] + ("..." if len(request.text) > 40 else ""),
            messages=[],
        )
        db.add(session)

    msg_id = str(uuid.uuid4())
    msg = {
        "id": msg_id,
        "text": request.text,
        "language_hint": request.language_hint,
        "platform": request.platform or "manual",
        "timestamp": datetime.utcnow().isoformat(),
        "result": request.result.model_dump() if hasattr(request.result, "model_dump") else request.result,
    }
    updated_messages = list(session.messages or [])
    updated_messages.append(msg)
    session.messages = updated_messages

    if session.title in ("New Intelligence Session", "Untitled Session") and request.text:
        session.title = request.text[:40] + ("..." if len(request.text) > 40 else "")

    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    return ChatSessionDetailSchema(
        id=session.id,
        title=session.title,
        user_id=session.user_id,
        messages=session.messages,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a chat session without deleting persisted moderation records."""
    stmt = select(ChatSession).where(ChatSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    await db.delete(session)
    await db.commit()
    return {"status": "deleted", "id": session_id}