"""Evaluation endpoints."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.feedback import EvaluationRun
from app.schemas.schemas import EvaluationRunSchema

router = APIRouter()


@router.get("", response_model=list[EvaluationRunSchema])
async def list_evaluation_runs(db: AsyncSession = Depends(get_db)):
    """List all evaluation runs."""
    result = await db.execute(
        select(EvaluationRun).order_by(EvaluationRun.created_at.desc())
    )
    return result.scalars().all()


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
    Trigger an evaluation run on available labeled data.
    NOTE: This requires a labeled test dataset to produce real metrics.
    Without labeled data, this will return an 'insufficient_data' status.
    """
    from app.models.moderation import ModerationRecord
    from sqlalchemy import func

    total = (await db.execute(select(func.count(ModerationRecord.id)))).scalar() or 0

    run = EvaluationRun(
        id=str(uuid.uuid4()),
        run_name=f"Evaluation Run — {uuid.uuid4().hex[:6]}",
        model_name="baseline",
        model_version="1.0.0",
        dataset_name="Current database records",
        total_samples=total,
        overall_metrics={
            "precision": None,
            "recall": None,
            "f1": None,
            "status": "insufficient_labeled_data",
            "note": (
                "Real evaluation metrics require a labeled test dataset with ground-truth labels. "
                "Import a labeled dataset via the Dataset & Model Lab to compute real metrics."
            ),
        },
        per_label_metrics={
            "hate_speech": {"samples": 0, "status": "insufficient_data"},
            "harassment": {"samples": 0, "status": "insufficient_data"},
            "cyberbullying": {"samples": 0, "status": "insufficient_data"},
            "legitimate": {"samples": 0, "status": "insufficient_data"},
        },
        per_language_metrics={
            "english": {"status": "insufficient_data"},
            "hindi": {"status": "insufficient_data"},
            "telugu": {"status": "insufficient_data"},
            "kannada": {"status": "insufficient_data"},
            "code_mixed": {"status": "insufficient_data"},
        },
        status="completed",
        notes="No labeled evaluation dataset available. Import labeled data to compute real metrics.",
    )
    db.add(run)
    await db.commit()

    return {
        "run_id": run.id,
        "status": "completed",
        "message": "Evaluation run recorded. Real metrics require a labeled test dataset.",
        "overall_metrics": run.overall_metrics,
    }
