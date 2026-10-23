"""Health and model status endpoints."""
import json
from pathlib import Path
from fastapi import APIRouter
from app.core.config import settings
from app.nlp.engine import get_nlp_engine
from app.schemas.schemas import ModelStatusSchema

router = APIRouter()

REPORT_PATH = Path("reports/evaluation_report.json")


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "Sentinel AI API",
        "version": "1.0.0",
    }


@router.get("/model/status", response_model=ModelStatusSchema)
async def model_status():
    engine = get_nlp_engine()
    
    # Check if baseline toxicity model is trained and available
    toxicity_loaded = engine.toxicity_predictor is not None and engine.toxicity_predictor.is_available()

    capabilities = [
        "Trained multilingual safety models (English, Hindi, Telugu, Hinglish, Kannada) using local scikit-learn pipelines with zero external API calls.",
        "Pattern-based detection of harassment, hate speech, and cyberbullying across multi-label schemas.",
        "Script-aware language detection and model registry covering all 22 Eighth Schedule Indian languages plus Hinglish.",
        "Code-mixed marker analysis for transliterated Indian-language conversations.",
        "Severity policy engine based on contextual risk thresholds.",
        "Context window comparison (evaluating text with before/after conversational turns).",
    ]
    if toxicity_loaded:
        capabilities.insert(1, "Trained English Toxicity Classification Baseline (TF-IDF + LogisticRegression on Civil Comments).")

    limitations = [
        "Validated automated models currently cover English, Hindi, Telugu, Hinglish, and Kannada.",
        "Other Indic languages (Bengali, Marathi, Tamil, Malayalam, Urdu, Gujarati, etc.) route with mandatory human review pending dataset training.",
        "Scores reflect local scikit-learn model calibrated probabilities and pattern evidence.",
        "Cannot fully understand complex figurative sarcasm or deep cultural metaphors without larger domain datasets.",
    ]

    return ModelStatusSchema(
        status="ready" if toxicity_loaded else engine.MODEL_STATUS,
        model_name="sentinel-hybrid-v1" if toxicity_loaded else settings.MODEL_NAME,
        model_version=settings.MODEL_VERSION,
        model_type="hybrid_ml_and_rule_baseline" if toxicity_loaded else "rule_based_baseline",
        is_trained=toxicity_loaded,
        training_data_available=REPORT_PATH.exists(),
        limitations=limitations,
        capabilities=capabilities,
    )


@router.get("/model/languages")
async def list_model_languages():
    """Returns the complete registry of all 22 scheduled Indian languages plus English and Hinglish."""
    from app.nlp.registry import get_model_registry
    registry = get_model_registry()
    return {
        "total_languages": len(registry.get_catalog_summary()),
        "languages": registry.get_catalog_summary()
    }
