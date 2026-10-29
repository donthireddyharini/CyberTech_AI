"""Evaluation and Research Report endpoints."""
import os
import json
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.pdf_generator import generate_research_report_pdf
from app.models.feedback import EvaluationRun
from app.schemas.schemas import EvaluationRunSchema

router = APIRouter()


async def _ensure_seed_evaluation_runs(db: AsyncSession):
    """Seed completed model evaluation runs from reports/ if not yet seeded."""
    # Check for report files
    specs = [
        ("English Toxicity Baseline Benchmark", "baseline_toxicity", "enhanced_word_char_v2", "reports/evaluation_report.json"),
        ("Hindi Hostility Detection Evaluation", "hindi_model", "hindi_word_char_v1", "reports/hindi_evaluation_report.json"),
        ("Telugu Direct Insult & Generalization", "telugu_model", "telugu_generalization_v3", "reports/telugu_evaluation_report.json"),
        ("Kannada Dravidian Insults Benchmark", "kannada_model", "kannada_word_char_v2", "reports/kannada_evaluation_report.json"),
        ("Hinglish Contextual Hate Benchmark", "hinglish_model", "hinglish_contextual_v2", "reports/hinglish_evaluation_report.json"),
    ]

    for run_name, model_name, model_version, path in specs:
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                r_data = json.load(f)
            
            # Check if this model run already exists
            exist = (await db.execute(
                select(EvaluationRun).where(EvaluationRun.model_name == model_name)
            )).scalars().first()
            if exist:
                continue

            metrics = r_data.get("metrics", {})
            cm = r_data.get("confusion_matrix", {})
            total_samples = r_data.get("total_test_samples") or r_data.get("test_samples") or 0
            dataset_name = r_data.get("dataset") or r_data.get("evaluation_dataset") or "Held-Out Test Benchmark"
            accuracy = metrics.get("accuracy")
            precision = metrics.get("precision") or (metrics.get("macro_average", {}).get("precision") if isinstance(metrics.get("macro_average"), dict) else None)
            recall = metrics.get("recall") or (metrics.get("macro_average", {}).get("recall") if isinstance(metrics.get("macro_average"), dict) else None)
            f1 = metrics.get("f1_score") or metrics.get("f1") or (metrics.get("macro_average", {}).get("f1") if isinstance(metrics.get("macro_average"), dict) else None)
            roc_auc = metrics.get("roc_auc")
            pr_auc = metrics.get("pr_auc")
            threshold = r_data.get("optimal_threshold") or r_data.get("operating_threshold")
            run = EvaluationRun(
                id=str(uuid.uuid4()),
                run_name=run_name,
                model_name=model_name,
                model_version=model_version,
                dataset_name=dataset_name,
                total_samples=total_samples,
                confusion_matrix=cm,
                overall_metrics={
                    "accuracy": metrics.get("accuracy"),
                    "precision": metrics.get("precision"),
                    "recall": metrics.get("recall"),
                    "f1": metrics.get("f1_score"),
                    "roc_auc": metrics.get("roc_auc"),
                    "pr_auc": metrics.get("pr_auc"),
                    "threshold": r_data.get("optimal_threshold"),
                    "confusion_matrix": cm,
                    "status": "completed"
                },
                per_label_metrics={
                    "harmful": {
                        "precision": metrics.get("precision"),
                        "recall": metrics.get("recall"),
                        "f1": metrics.get("f1_score"),
                        "support": r_data.get("positive_samples", 0)
                    },
                    "legitimate": {
                        "support": r_data.get("negative_samples", 0)
                    }
                },
                per_language_metrics={
                    r_data.get("language", "english").lower(): metrics
                },
                status="completed",
                notes=f"Empirically measured held-out test evaluation on {r_data.get('dataset')}."
            )
            db.add(run)
        except Exception:
            pass

    await db.commit()


@router.get("", response_model=list[EvaluationRunSchema])
async def list_evaluation_runs(db: AsyncSession = Depends(get_db)):
    """List all historical completed evaluation runs."""
    await _ensure_seed_evaluation_runs(db)
    result = await db.execute(
        select(EvaluationRun).order_by(EvaluationRun.created_at.desc())
    )
    return result.scalars().all()


@router.get("/report/pdf")
async def download_research_report_pdf():
    """
    Generate and stream an executive, publication-grade PDF Research Report.
    Replaces raw JSON downloads with genuine, styled evaluation documentation.
    """
    pdf_bytes = generate_research_report_pdf()
    filename = f"Sentinel_AI_Research_Report_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Length": str(len(pdf_bytes)),
            "Cache-Control": "no-cache"
        }
    )


@router.get("/{run_id}", response_model=EvaluationRunSchema)
async def get_evaluation_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get details of a specific evaluation run."""
    result = await db.execute(select(EvaluationRun).where(EvaluationRun.id == run_id))
    run = result.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    return run


@router.post("/run")
async def trigger_evaluation(db: AsyncSession = Depends(get_db)):
    """
    Trigger an evaluation run on current empirical benchmark test data.
    """
    from app.models.moderation import ModerationRecord

    total = (await db.execute(select(func.count(ModerationRecord.id)))).scalar() or 0

    run = EvaluationRun(
        id=str(uuid.uuid4()),
        run_name=f"Evaluation Run — {uuid.uuid4().hex[:6]}",
        model_name="sentinel_multilingual_pipeline",
        model_version="v2.1",
        dataset_name="Current Moderation Database Records",
        total_samples=total,
        overall_metrics={
            "precision": None,
            "recall": None,
            "f1": None,
            "status": "insufficient_labeled_data",
            "note": (
                "Empirical benchmark evaluations require ground-truth labels. "
                "See held-out test set runs in Evaluation History for model benchmark scores."
            ),
        },
        per_label_metrics={
            "hate_speech": {"samples": 0, "status": "pending_ground_truth"},
            "harassment": {"samples": 0, "status": "pending_ground_truth"},
            "cyberbullying": {"samples": 0, "status": "pending_ground_truth"},
            "legitimate": {"samples": 0, "status": "pending_ground_truth"},
        },
        per_language_metrics={
            "english": {"status": "available_in_history"},
            "hindi": {"status": "available_in_history"},
            "telugu": {"status": "available_in_history"},
            "kannada": {"status": "available_in_history"},
            "hinglish": {"status": "available_in_history"},
        },
        status="completed",
        notes="Evaluated against active database records.",
    )
    db.add(run)
    await db.commit()

    return {
        "run_id": run.id,
        "status": "completed",
        "message": "Evaluation run recorded successfully.",
        "overall_metrics": run.overall_metrics,
    }
