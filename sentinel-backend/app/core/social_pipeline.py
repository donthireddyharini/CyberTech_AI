"""
Social Ingestion Pipeline for CyberTech AI.
Coordinates deduplication, local ML toxicity/harassment inference, and persistence into SQLite.
Strictly uses local scikit-learn models (zero external LLM API dependencies for inference).
"""
import time
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.base import NormalizedSocialComment
from app.models.moderation import ModerationRecord
from app.models.social import SocialSyncLog
from app.models.feedback import DatasetRun
from app.nlp.engine import get_nlp_engine

logger = logging.getLogger(__name__)


async def ingest_social_comments(
    db: AsyncSession,
    comments: List[NormalizedSocialComment],
    platform: str,
    target_input: str,
    user_id: Optional[str] = None,
    requested_count: Optional[int] = None
) -> Dict[str, Any]:
    """
    Ingests normalized social comments into CyberTech AI:
      1. Deduplicates against existing database records (by platform + source_id).
      2. Executes offline local ML inference via get_nlp_engine().
      3. Persists ModerationRecords with complete source metadata.
      4. Records a SocialSyncLog and DatasetRun for telemetry & audit trail.
    """
    t0 = time.time()
    engine = get_nlp_engine()

    total_fetched = len(comments)
    req_count = requested_count if requested_count is not None else total_fetched
    if total_fetched == 0:
        return {
            "sync_id": str(uuid.uuid4()),
            "platform": platform,
            "target_input": target_input,
            "requested_count": req_count,
            "total_fetched": 0,
            "newly_ingested": 0,
            "duplicate_count": 0,
            "failed_count": 0,
            "flagged_count": 0,
            "approved_count": 0,
            "records": [],
            "processing_time_ms": 0.0,
        }

    # Extract all comment IDs for deduplication
    comment_ids = [c.comment_id for c in comments if c.comment_id]

    existing_records_map: Dict[str, ModerationRecord] = {}
    if comment_ids:
        # Check database for existing records under this platform scoped to this user
        conditions = [
            ModerationRecord.platform == platform,
            ModerationRecord.source_id.in_(comment_ids)
        ]
        if user_id:
            conditions.append(ModerationRecord.user_id == user_id)
        else:
            conditions.append(ModerationRecord.user_id.is_(None))
        q = select(ModerationRecord).where(and_(*conditions))
        res = await db.execute(q)
        existing_records_list = res.scalars().all()
        for r in existing_records_list:
            if r.source_id:
                existing_records_map[r.source_id] = r

    # In-batch deduplication + DB deduplication
    seen_in_batch = set()
    unique_comments: List[NormalizedSocialComment] = []
    duplicate_records_for_preview: List[ModerationRecord] = []
    duplicate_count = 0

    for c in comments:
        cid = c.comment_id
        if cid in seen_in_batch:
            duplicate_count += 1
            continue
        seen_in_batch.add(cid)

        if cid in existing_records_map:
            duplicate_count += 1
            duplicate_records_for_preview.append(existing_records_map[cid])
            continue

        unique_comments.append(c)

    new_records: List[ModerationRecord] = []
    preview_items: List[Dict[str, Any]] = []
    flagged_count = 0
    approved_count = 0
    lang_breakdown: Dict[str, int] = {}
    sev_breakdown: Dict[str, int] = {"low": 0, "medium": 0, "high": 0, "uncertain": 0}

    # Include existing records in preview items so previously ingested comments display in table & history
    for rec in duplicate_records_for_preview:
        is_flagged = (rec.decision != "no_action") or (rec.status == "pending")
        if is_flagged:
            flagged_count += 1
        else:
            approved_count += 1

        sev = rec.severity if rec.severity in sev_breakdown else "uncertain"
        sev_breakdown[sev] += 1

        lang = rec.detected_language or "unknown"
        lang_breakdown[lang] = lang_breakdown.get(lang, 0) + 1

        tox_val = max(
            rec.hate_speech_score or 0.0,
            rec.harassment_score or 0.0,
            rec.cyberbullying_score or 0.0,
        )
        if tox_val == 0.0 and rec.legitimate_score:
            tox_val = round(1.0 - rec.legitimate_score, 3)

        preview_items.append({
            "id": rec.id,
            "comment_id": rec.source_id,
            "text": rec.original_text,
            "author_name": rec.author_name or "user",
            "source_url": rec.source_url,
            "parent_id": rec.parent_comment_id,
            "severity": rec.severity,
            "decision": rec.decision,
            "detected_language": rec.detected_language,
            "toxicity_score": tox_val,
            "hate_speech_score": rec.hate_speech_score,
            "harassment_score": rec.harassment_score,
            "cyberbullying_score": rec.cyberbullying_score,
            "legitimate_score": rec.legitimate_score,
            "is_flagged": is_flagged,
            "platform": rec.platform or platform,
            "published_at": (rec.created_at or datetime.utcnow()).isoformat(),
            "processing_time_ms": rec.processing_time_ms or 1.2,
        })

    for item in unique_comments:
        rec_id = str(uuid.uuid4())
        analysis = engine.analyze(text=item.text)

        is_flagged = (analysis.decision != "no_action") or (
            analysis.toxicity_prediction is not None and analysis.toxicity_prediction.is_toxic
        )

        if is_flagged:
            flagged_count += 1
        else:
            approved_count += 1

        sev = analysis.severity if analysis.severity in sev_breakdown else "uncertain"
        sev_breakdown[sev] += 1

        lang = analysis.detected_language or "unknown"
        lang_breakdown[lang] = lang_breakdown.get(lang, 0) + 1

        # Use current UTC ingestion time for record creation so analytics and timeframes reflect ingestion
        ingestion_now = datetime.utcnow()

        rec = ModerationRecord(
            id=rec_id,
            original_text=item.text,
            normalized_text=analysis.text,
            model_name=analysis.model_name,
            model_version=analysis.model_version,
            labels=[{"label": l.label, "score": l.score, "evidence": l.evidence} for l in analysis.labels],
            hate_speech_score=next((l.score for l in analysis.labels if l.label == "hate_speech"), 0.0),
            harassment_score=next((l.score for l in analysis.labels if l.label == "harassment"), 0.0),
            cyberbullying_score=next((l.score for l in analysis.labels if l.label == "cyberbullying"), 0.0),
            legitimate_score=next((l.score for l in analysis.labels if l.label == "legitimate"), 0.0),
            severity=analysis.severity,
            severity_reason=analysis.severity_reason,
            decision=analysis.decision,
            confidence_level=analysis.confidence_level,
            recommended_action=analysis.recommended_action,
            ambiguity_warning=analysis.ambiguity_warning,
            detected_language=analysis.detected_language,
            is_code_mixed=analysis.is_code_mixed,
            status="pending" if is_flagged else "reviewed",
            platform=platform,
            source_id=item.comment_id,
            source_url=item.source_url,
            author_name=item.author_name,
            author_id=item.author_id,
            parent_comment_id=item.parent_id,
            user_id=user_id,
            is_demo=False,
            created_at=ingestion_now,
            inference_timestamp=analysis.inference_timestamp,
            processing_time_ms=analysis.processing_time_ms,
        )

        db.add(rec)
        new_records.append(rec)

        tox_score = analysis.toxicity_prediction.toxicity_score if analysis.toxicity_prediction else None
        if tox_score is None:
            tox_score = max((l.score for l in analysis.labels if l.label != "legitimate"), default=0.0)

        preview_items.append({
            "id": rec_id,
            "comment_id": item.comment_id,
            "text": item.text,
            "author_name": item.author_name,
            "source_url": item.source_url,
            "parent_id": item.parent_id,
            "severity": analysis.severity,
            "decision": analysis.decision,
            "detected_language": analysis.detected_language,
            "toxicity_score": tox_score,
            "hate_speech_score": next((l.score for l in analysis.labels if l.label == "hate_speech"), 0.0),
            "harassment_score": next((l.score for l in analysis.labels if l.label == "harassment"), 0.0),
            "cyberbullying_score": next((l.score for l in analysis.labels if l.label == "cyberbullying"), 0.0),
            "legitimate_score": next((l.score for l in analysis.labels if l.label == "legitimate"), 0.0),
            "is_flagged": is_flagged,
            "platform": platform,
            "published_at": (item.published_at or ingestion_now).isoformat(),
            "processing_time_ms": analysis.processing_time_ms,
        })

    total_time_ms = round((time.time() - t0) * 1000, 2)
    newly_ingested = len(new_records)

    # Record SocialSyncLog
    sync_log = SocialSyncLog(
        id=str(uuid.uuid4()),
        platform=platform,
        target_input=target_input,
        total_fetched=total_fetched,
        newly_ingested=newly_ingested,
        duplicate_count=duplicate_count,
        flagged_count=flagged_count,
        approved_count=approved_count,
        status="completed" if newly_ingested > 0 or duplicate_count > 0 else "empty",
        error_message=None,
        processing_time_ms=total_time_ms,
        user_id=user_id,
    )
    db.add(sync_log)

    # Record DatasetRun so that the batch sync appears in batch runs / history
    total_preview = len(preview_items)
    if total_preview > 0:
        dataset_run = DatasetRun(
            id=str(uuid.uuid4()),
            dataset_name=f"{platform.capitalize()} Ingestion: {target_input[:60]}",
            dataset_id=None,
            user_id=user_id,
            status="completed",
            total_samples=total_preview,
            processed_count=total_preview,
            failed_count=0,
            flagged_count=flagged_count,
            approved_count=approved_count,
            language_breakdown=lang_breakdown,
            severity_breakdown=sev_breakdown,
            processing_time_ms=total_time_ms,
        )
        db.add(dataset_run)

    await db.commit()

    return {
        "sync_id": sync_log.id,
        "platform": platform,
        "target_input": target_input,
        "requested_count": req_count,
        "total_fetched": total_fetched,
        "newly_ingested": newly_ingested,
        "duplicate_count": duplicate_count,
        "failed_count": 0,
        "flagged_count": flagged_count,
        "approved_count": approved_count,
        "language_breakdown": lang_breakdown,
        "severity_breakdown": sev_breakdown,
        "records": preview_items,
        "processing_time_ms": total_time_ms,
    }
