"""
Sentinel AI — Local Real-Time Comment Monitoring & Batch Ingestion Engine
(CSEAIML2026-P03)

Faculty Constraints Compliance:
1. Zero API Keys: Operates 100% locally with offline model inference.
2. No Social Media Scraping: Accurately operates on user-submitted text and
   lawfully imported CSV datasets.
3. Resilient Processing: Automatic schema mapping, encoding normalization,
   in-memory deduplication, incremental local analysis, and live status tracking.
"""
import io
import csv
import time
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.nlp.engine import get_nlp_engine
from app.models.moderation import ModerationRecord, HumanReview
from app.models.feedback import FeedbackRecord
from app.schemas.schemas import AnalyzeResponse
from app.api.v1.analyze import _result_to_schema

logger = logging.getLogger(__name__)

router = APIRouter()

# Schema for Batch Text Submission
class BatchTextSubmission(BaseModel):
    comments: List[str] = Field(..., description="List of comments to analyze in real-time.")
    language_hint: Optional[str] = Field(None, description="Optional language hint override.")
    platform_source: str = Field("Direct Submission", description="Source description.")
    deduplicate: bool = Field(True, description="Whether to filter out duplicate comments.")

class BatchMonitoringResponse(BaseModel):
    monitoring_mode: str = "local_offline_pipeline"
    platform_notice: str = "Real-time analysis of submitted/imported comments. Zero external API calls or social media scraping."
    total_received: int
    processed_count: int
    duplicate_count: int
    flagged_count: int
    approved_count: int
    severity_breakdown: Dict[str, int]
    language_breakdown: Dict[str, int]
    processing_time_ms: float
    items: List[Dict[str, Any]]

class MonitoringStatusResponse(BaseModel):
    monitoring_status: str = "active_local_listening"
    offline_local_inference: bool = True
    api_keys_required: bool = False
    external_network_calls: bool = False
    active_model_name: str
    active_threshold: float
    total_monitored_records: int
    flagged_records_count: int
    pending_human_review_count: int
    reviewed_records_count: int
    last_processed_timestamp: Optional[str]


@router.get("/status", response_model=MonitoringStatusResponse)
async def get_monitoring_status(db: AsyncSession = Depends(get_db)):
    """Provides transparency on the active local monitoring engine."""
    engine = get_nlp_engine()
    
    total_q = select(func.count(ModerationRecord.id))
    flagged_q = select(func.count(ModerationRecord.id)).where(ModerationRecord.decision != "no_action")
    pending_q = select(func.count(ModerationRecord.id)).where(ModerationRecord.status == "pending")
    reviewed_q = select(func.count(ModerationRecord.id)).where(ModerationRecord.status == "reviewed")
    latest_q = select(ModerationRecord.created_at).order_by(ModerationRecord.created_at.desc()).limit(1)

    total = (await db.execute(total_q)).scalar() or 0
    flagged = (await db.execute(flagged_q)).scalar() or 0
    pending = (await db.execute(pending_q)).scalar() or 0
    reviewed = (await db.execute(reviewed_q)).scalar() or 0
    latest = (await db.execute(latest_q)).scalar()

    predictor = getattr(engine, "_toxicity_predictor", None)
    model_name = getattr(predictor, "model_version", "enhanced_word_char_v2")
    threshold = 0.40

    return MonitoringStatusResponse(
        monitoring_status="active_local_listening",
        offline_local_inference=True,
        api_keys_required=False,
        external_network_calls=False,
        active_model_name=f"{model_name} (models/baseline_toxicity.joblib)",
        active_threshold=threshold,
        total_monitored_records=total,
        flagged_records_count=flagged,
        pending_human_review_count=pending,
        reviewed_records_count=reviewed,
        last_processed_timestamp=latest.isoformat() if latest else None,
    )


@router.post("/batch-analyze", response_model=BatchMonitoringResponse)
async def batch_analyze_comments(
    payload: BatchTextSubmission,
    db: AsyncSession = Depends(get_db)
):
    """
    Analyzes a batch of comments submitted in real-time.
    Supports in-memory deduplication and saves each moderation record locally.
    """
    t0 = time.time()
    engine = get_nlp_engine()
    
    raw_comments = [c.strip() for c in payload.comments if c and c.strip()]
    total_received = len(raw_comments)
    
    # In-memory deduplication
    processed_comments = []
    seen = set()
    dup_count = 0
    for c in raw_comments:
        norm = c.lower()
        if payload.deduplicate:
            if norm in seen:
                dup_count += 1
                continue
            seen.add(norm)
        processed_comments.append(c)

    results = []
    flagged_count = 0
    approved_count = 0
    severity_dist: Dict[str, int] = {"low": 0, "medium": 0, "high": 0, "uncertain": 0}
    lang_dist: Dict[str, int] = {}

    for text in processed_comments:
        analysis = engine.analyze(text=text, language_hint=payload.language_hint)
        rec_id = str(uuid.uuid4())
        is_flagged = (analysis.decision != "no_action") or (
            analysis.toxicity_prediction is not None and analysis.toxicity_prediction.is_toxic
        )
        
        if is_flagged:
            flagged_count += 1
        else:
            approved_count += 1
            
        sev = analysis.severity if analysis.severity in severity_dist else "uncertain"
        severity_dist[sev] += 1
        
        lang = analysis.detected_language or "unknown"
        lang_dist[lang] = lang_dist.get(lang, 0) + 1

        # Store in database
        rec = ModerationRecord(
            id=rec_id,
            original_text=analysis.original_text,
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
            language_hint=payload.language_hint,
            status="pending" if is_flagged else "reviewed",
            platform=payload.platform_source,
            is_demo=False,
            inference_timestamp=analysis.inference_timestamp,
            processing_time_ms=analysis.processing_time_ms,
        )
        db.add(rec)
        
        results.append({
            "id": rec_id,
            "text": text,
            "toxicity_score": analysis.toxicity_prediction.toxicity_score if analysis.toxicity_prediction else None,
            "is_toxic": analysis.toxicity_prediction.is_toxic if analysis.toxicity_prediction else False,
            "detected_language": analysis.detected_language,
            "severity": analysis.severity,
            "decision": analysis.decision,
            "review_status": analysis.language_route.review_status if analysis.language_route else "automated_pass_or_flag",
            "model_version": analysis.model_version,
            "processing_time_ms": analysis.processing_time_ms,
        })

    await db.commit()
    elapsed_ms = round((time.time() - t0) * 1000, 2)

    return BatchMonitoringResponse(
        monitoring_mode="local_offline_pipeline",
        platform_notice="Real-time analysis of submitted/imported comments. Zero external API calls or social media scraping.",
        total_received=total_received,
        processed_count=len(processed_comments),
        duplicate_count=dup_count,
        flagged_count=flagged_count,
        approved_count=approved_count,
        severity_breakdown=severity_dist,
        language_breakdown=lang_dist,
        processing_time_ms=elapsed_ms,
        items=results
    )


@router.post("/upload-csv", response_model=BatchMonitoringResponse)
async def upload_csv_monitoring(
    file: UploadFile = File(...),
    deduplicate: bool = Form(True),
    language_hint: Optional[str] = Form(None),
    platform_name: str = Form("CSV Import"),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests and incrementally analyzes comments from an uploaded CSV or TXT file.
    Validates schema, normalizes encodings (UTF-8 / Latin-1), and removes duplicates.
    """
    if not file.filename.lower().endswith((".csv", ".tsv", ".txt")):
        raise HTTPException(status_code=400, detail="Only CSV, TSV, or TXT files are supported.")
        
    content_bytes = await file.read()
    
    # Resilient decoding
    text_content = ""
    for enc in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
        try:
            text_content = content_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
            
    if not text_content:
        text_content = content_bytes.decode("utf-8", errors="replace")

    comments: List[str] = []
    
    if file.filename.lower().endswith(".txt"):
        comments = [line.strip() for line in text_content.splitlines() if line.strip()]
    else:
        # Delimiter detection
        delimiter = "\t" if file.filename.lower().endswith(".tsv") else ","
        try:
            sample = text_content[:2048]
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t;")
            delimiter = dialect.delimiter
        except Exception:
            pass

        reader = csv.reader(io.StringIO(text_content), delimiter=delimiter)
        rows = list(reader)
        if not rows:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        header = [col.lower().strip() for col in rows[0]]
        
        # Identify target text column
        text_idx = -1
        preferred_names = ["comment", "text", "message", "content", "body", "tweet", "cleaned_text", "comment_text"]
        for name in preferred_names:
            if name in header:
                text_idx = header.index(name)
                break
                
        start_row = 1
        if text_idx == -1:
            # If no recognizable header, treat first column of row 0 as data if no header detected
            text_idx = 0
            start_row = 0

        for r in rows[start_row:]:
            if len(r) > text_idx and r[text_idx].strip():
                comments.append(r[text_idx].strip())

    if not comments:
        raise HTTPException(status_code=400, detail="No readable text comments found in the uploaded file.")

    # Delegate to batch submission
    submission = BatchTextSubmission(
        comments=comments,
        language_hint=language_hint,
        platform_source=f"Imported File ({file.filename})",
        deduplicate=deduplicate
    )
    return await batch_analyze_comments(submission, db)


@router.get("/export-reviewed-feedback")
async def export_reviewed_feedback(
    format: str = Query("csv", pattern="^(csv|jsonl)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Exports all human-reviewed moderation records and feedback for future offline model retraining.
    Stores reviewer corrections separately from original model predictions.
    """
    query = (
        select(ModerationRecord, HumanReview, FeedbackRecord)
        .outerjoin(HumanReview, ModerationRecord.id == HumanReview.record_id)
        .outerjoin(FeedbackRecord, ModerationRecord.id == FeedbackRecord.record_id)
        .where(
            (ModerationRecord.status == "reviewed") |
            (HumanReview.id.isnot(None)) |
            (FeedbackRecord.id.isnot(None))
        )
        .order_by(ModerationRecord.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    export_records = []
    for mod_rec, rev, fb in rows:
        corrected_label = None
        reviewer_id = None
        review_notes = None
        action = None
        
        if rev:
            action = rev.action
            reviewer_id = rev.reviewer_id
            review_notes = rev.reviewer_notes
            if rev.corrected_labels and isinstance(rev.corrected_labels, list) and len(rev.corrected_labels) > 0:
                corrected_label = rev.corrected_labels[0].get("label")

        if fb and not corrected_label:
            if fb.corrected_labels and isinstance(fb.corrected_labels, list) and len(fb.corrected_labels) > 0:
                corrected_label = fb.corrected_labels[0].get("label")
            if not reviewer_id:
                reviewer_id = fb.reviewer_id

        # Determine target label for retraining (1: toxic/violating, 0: safe/legitimate)
        is_toxic_target = 0
        if corrected_label in ["hate_speech", "harassment", "cyberbullying", "toxic"]:
            is_toxic_target = 1
        elif action in ["escalate", "flag"]:
            is_toxic_target = 1
        elif action in ["approve", "dismiss"]:
            is_toxic_target = 0
        elif mod_rec.decision != "no_action":
            is_toxic_target = 1

        export_records.append({
            "record_id": mod_rec.id,
            "text": mod_rec.original_text,
            "detected_language": mod_rec.detected_language or "en",
            "model_version": mod_rec.model_version,
            "original_decision": mod_rec.decision,
            "original_severity": mod_rec.severity,
            "human_action": action or "auto_reviewed",
            "corrected_label": corrected_label or ("non_toxic" if is_toxic_target == 0 else "toxic"),
            "target_binary_label": is_toxic_target,
            "reviewer_id": reviewer_id or "system",
            "reviewer_notes": review_notes or "",
            "created_at": mod_rec.created_at.isoformat() if mod_rec.created_at else "",
        })

    if format == "jsonl":
        import json
        lines = [json.dumps(r, ensure_ascii=False) for r in export_records]
        output = "\n".join(lines)
        return StreamingResponse(
            io.StringIO(output),
            media_type="application/x-ndjson",
            headers={"Content-Disposition": "attachment; filename=sentinel_retraining_dataset.jsonl"}
        )
    else:
        output = io.StringIO()
        fieldnames = [
            "record_id", "text", "detected_language", "model_version",
            "original_decision", "original_severity", "human_action",
            "corrected_label", "target_binary_label", "reviewer_id", "reviewer_notes", "created_at"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in export_records:
            writer.writerow(r)
            
        output.seek(0)
        return StreamingResponse(
            io.StringIO(output.getvalue()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=sentinel_retraining_dataset.csv"}
        )
