"""Dataset management endpoints."""
import io
import uuid
import csv
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.feedback import DatasetRecord
from app.schemas.schemas import DatasetValidationResponse, DatasetImportRequest

router = APIRouter()

REQUIRED_COLUMNS = {"text", "label"}
VALID_LABELS = {"hate_speech", "harassment", "cyberbullying", "legitimate", "none"}


@router.get("")
async def list_datasets(db: AsyncSession = Depends(get_db)):
    """List imported datasets."""
    result = await db.execute(select(DatasetRecord).order_by(DatasetRecord.created_at.desc()))
    datasets = result.scalars().all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "version": d.version,
            "source": d.source,
            "total_records": d.total_records,
            "train_count": d.train_count,
            "val_count": d.val_count,
            "test_count": d.test_count,
            "label_distribution": d.label_distribution,
            "language_distribution": d.language_distribution,
            "status": d.status,
            "license_info": d.license_info,
            "created_at": d.created_at.isoformat(),
        }
        for d in datasets
    ]


@router.post("/validate", response_model=DatasetValidationResponse)
async def validate_dataset(file: UploadFile = File(...)):
    """Validate an uploaded CSV or JSONL dataset without importing it."""
    content = await file.read()
    errors = []
    warnings = []
    rows = []

    if file.filename.endswith(".csv"):
        try:
            reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
            rows = list(reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"CSV parse error: {str(e)}")
    elif file.filename.endswith(".jsonl") or file.filename.endswith(".json"):
        try:
            for line in content.decode("utf-8", errors="replace").strip().splitlines():
                rows.append(json.loads(line))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"JSONL parse error: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Only CSV and JSONL files are supported.")

    if not rows:
        raise HTTPException(status_code=400, detail="File is empty.")

    columns = set(rows[0].keys()) if rows else set()
    missing_cols = REQUIRED_COLUMNS - columns
    if missing_cols:
        errors.append(f"Missing required columns: {missing_cols}")

    missing_vals = sum(1 for r in rows if not r.get("text") or not r.get("label"))
    
    seen = set()
    duplicates = 0
    for r in rows:
        key = str(r.get("text", ""))
        if key in seen:
            duplicates += 1
        seen.add(key)

    label_dist: dict = {}
    lang_dist: dict = {}
    invalid_labels = 0
    for r in rows:
        lbl = str(r.get("label", "")).lower().strip()
        lang = str(r.get("language", "unknown")).lower().strip()
        label_dist[lbl] = label_dist.get(lbl, 0) + 1
        lang_dist[lang] = lang_dist.get(lang, 0) + 1
        if lbl and lbl not in VALID_LABELS:
            invalid_labels += 1

    if invalid_labels > 0:
        warnings.append(f"{invalid_labels} rows have labels outside the expected set {VALID_LABELS}.")
    if duplicates > 0:
        warnings.append(f"{duplicates} potential duplicate records found.")
    if missing_vals > 0:
        warnings.append(f"{missing_vals} rows with missing text or label values.")

    preview = [dict(r) for r in rows[:5]]

    return DatasetValidationResponse(
        valid=len(errors) == 0,
        total_rows=len(rows),
        missing_values=missing_vals,
        duplicate_count=duplicates,
        label_distribution=label_dist,
        language_distribution=lang_dist,
        errors=errors,
        warnings=warnings,
        preview=preview,
    )


@router.post("/import")
async def import_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    version: str = Form("1.0.0"),
    source: Optional[str] = Form(None),
    license_info: Optional[str] = Form(None),
    permitted_use: Optional[str] = Form(None),
    train_ratio: float = Form(0.7),
    val_ratio: float = Form(0.15),
    test_ratio: float = Form(0.15),
    db: AsyncSession = Depends(get_db),
):
    """Import a validated dataset into the system."""
    content = await file.read()
    rows = []

    if file.filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(content.decode("utf-8", errors="replace")))
        rows = list(reader)
    elif file.filename.endswith(".jsonl") or file.filename.endswith(".json"):
        for line in content.decode("utf-8", errors="replace").strip().splitlines():
            try:
                rows.append(json.loads(line))
            except Exception:
                pass

    total = len(rows)
    train_n = int(total * train_ratio)
    val_n = int(total * val_ratio)
    test_n = total - train_n - val_n

    label_dist: dict = {}
    lang_dist: dict = {}
    for r in rows:
        lbl = str(r.get("label", "unknown")).lower()
        lang = str(r.get("language", "unknown")).lower()
        label_dist[lbl] = label_dist.get(lbl, 0) + 1
        lang_dist[lang] = lang_dist.get(lang, 0) + 1

    missing = sum(1 for r in rows if not r.get("text") or not r.get("label"))
    seen = set()
    dups = 0
    for r in rows:
        k = str(r.get("text", ""))
        if k in seen:
            dups += 1
        seen.add(k)

    dataset = DatasetRecord(
        id=str(uuid.uuid4()),
        name=name,
        version=version,
        source=source,
        license_info=license_info,
        permitted_use=permitted_use,
        total_records=total,
        train_count=train_n,
        val_count=val_n,
        test_count=test_n,
        label_distribution=label_dist,
        language_distribution=lang_dist,
        missing_values=missing,
        duplicate_count=dups,
        status="imported",
    )
    db.add(dataset)
    await db.commit()

    return {
        "message": "Dataset imported successfully",
        "dataset_id": dataset.id,
        "total_records": total,
        "split": {"train": train_n, "val": val_n, "test": test_n},
    }
