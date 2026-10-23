"""
Sentinel AI - Multilingual & Toxicity Inference Module
(CSEAIML2026-P03)

Provides clean, reusable inference functions for predicting toxicity and hate speech
across supported languages using trained local scikit-learn pipelines:
  - English: models/baseline_toxicity.joblib (threshold=0.40)
  - Telugu: models/telugu_model.joblib (threshold=0.29)
  - Hindi: models/hindi_model.joblib (threshold=0.50)
  - Hinglish / Code-Mixed: models/hinglish_model.joblib (threshold=0.29)
  - Kannada: models/kannada_model.joblib (threshold=0.55)

Purely local execution without external API calls or API keys.
"""
import os
import json
import logging
import joblib
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(PROJECT_ROOT, "models")
DEFAULT_MODEL_PATH = os.path.join(MODELS_DIR, "baseline_toxicity.joblib")


class ToxicityBaselinePredictor:
    """English toxicity baseline predictor preserved for backward compatibility."""
    def __init__(self, model_path: str = DEFAULT_MODEL_PATH):
        self.model_path = model_path
        self._model = None
        self._load_model()
        
    def _load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Toxicity baseline model not found at '{self.model_path}'. "
                "Ensure ml/train.py has been run."
            )
        self._model = joblib.load(self.model_path)

    def is_available(self) -> bool:
        return self._model is not None
        
    def predict(self, text: str, threshold: float = 0.40) -> Dict[str, Any]:
        if not text or not text.strip():
            return {
                "text": text,
                "is_toxic": False,
                "toxicity_score": 0.0,
                "confidence": 1.0,
                "threshold": threshold,
                "model_version": "enhanced_word_char_v2"
            }
            
        cleaned = text.strip()
        proba = float(self._model.predict_proba([cleaned])[0, 1])
        is_toxic = bool(proba >= threshold)
        
        return {
            "text": cleaned,
            "is_toxic": is_toxic,
            "toxicity_score": round(proba, 4),
            "confidence": round(abs(proba - threshold) / max(threshold, 1.0 - threshold), 4),
            "threshold": threshold,
            "model_version": "enhanced_word_char_v2",
            "scope_notice": "English toxicity baseline only. Not multilingual hate speech."
        }
        
    def predict_batch(self, texts: List[str], threshold: float = 0.40) -> List[Dict[str, Any]]:
        return [self.predict(t, threshold=threshold) for t in texts]


class MultilingualPredictor:
    """
    Unified local inference engine for English and Indic languages.
    Loads models lazily on first call and caches them in memory.
    """
    LANGUAGE_CONFIGS = {
        "english": {
            "model_filename": "baseline_toxicity.joblib",
            "config_filename": "model_config.json",
            "default_threshold": 0.40,
            "default_version": "enhanced_word_char_v2",
            "task": "English Toxicity Classification (Civil Comments)"
        },
        "telugu": {
            "model_filename": "telugu_model.joblib",
            "config_filename": "telugu_config.json",
            "default_threshold": 0.29,
            "default_version": "telugu_word_char_v1",
            "task": "Telugu Hate Speech Classification (IIIT Hyderabad)"
        },
        "hindi": {
            "model_filename": "hindi_model.joblib",
            "config_filename": "hindi_config.json",
            "default_threshold": 0.50,
            "default_version": "hindi_word_char_v1",
            "task": "Hindi Social Media Hostility Classification"
        },
        "hinglish": {
            "model_filename": "hinglish_model.joblib",
            "config_filename": "hinglish_config.json",
            "default_threshold": 0.29,
            "default_version": "hinglish_word_char_v1",
            "task": "Hinglish Code-Mixed Hate Speech Classification (PRISM)"
        },
        "code_mixed": {
            "model_filename": "hinglish_model.joblib",
            "config_filename": "hinglish_config.json",
            "default_threshold": 0.29,
            "default_version": "hinglish_word_char_v1",
            "task": "Hinglish Code-Mixed Hate Speech Classification (PRISM)"
        },
        "kannada": {
            "model_filename": "kannada_model.joblib",
            "config_filename": "kannada_config.json",
            "default_threshold": 0.55,
            "default_version": "kannada_word_char_v1",
            "task": "Kannada Offensive Language Classification (OffenseVal)"
        }
    }

    def __init__(self, models_dir: str = MODELS_DIR):
        self.models_dir = models_dir
        self._loaded_models: Dict[str, Any] = {}
        self._configs: Dict[str, Dict[str, Any]] = {}

    def is_language_supported(self, language: str) -> bool:
        lang_key = language.lower().strip()
        if lang_key not in self.LANGUAGE_CONFIGS:
            return False
        spec = self.LANGUAGE_CONFIGS[lang_key]
        model_path = os.path.join(self.models_dir, spec["model_filename"])
        return os.path.exists(model_path)

    def _get_model(self, lang_key: str):
        if lang_key in self._loaded_models:
            return self._loaded_models[lang_key]

        spec = self.LANGUAGE_CONFIGS[lang_key]
        model_path = os.path.join(self.models_dir, spec["model_filename"])
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model checkpoint for '{lang_key}' not found at '{model_path}'.")

        logger.info(f"Loading local model checkpoint for '{lang_key}' from {model_path}...")
        model = joblib.load(model_path)
        self._loaded_models[lang_key] = model

        # Load config if present
        config_path = os.path.join(self.models_dir, spec["config_filename"])
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    self._configs[lang_key] = json.load(f)
            except Exception as e:
                logger.warning(f"Could not load config for '{lang_key}': {e}")

        return model

    def get_threshold(self, lang_key: str) -> float:
        if lang_key in self._configs and "optimal_threshold" in self._configs[lang_key]:
            return float(self._configs[lang_key]["optimal_threshold"])
        return self.LANGUAGE_CONFIGS[lang_key]["default_threshold"]

    def get_version(self, lang_key: str) -> str:
        if lang_key in self._configs and "model_version" in self._configs[lang_key]:
            return str(self._configs[lang_key]["model_version"])
        return self.LANGUAGE_CONFIGS[lang_key]["default_version"]

    def predict(self, text: str, language: str = "english", threshold_override: Optional[float] = None) -> Dict[str, Any]:
        """
        Runs local inference for the specified language.
        Returns toxicity prediction dict with calibrated probability, boolean flag, and metadata.
        """
        lang_key = language.lower().strip()
        if lang_key not in self.LANGUAGE_CONFIGS:
            raise ValueError(f"Language '{language}' is not supported by MultilingualPredictor.")

        model = self._get_model(lang_key)
        threshold = threshold_override if threshold_override is not None else self.get_threshold(lang_key)
        version = self.get_version(lang_key)
        task_info = self.LANGUAGE_CONFIGS[lang_key]["task"]

        if not text or not text.strip():
            return {
                "text": text,
                "is_toxic": False,
                "toxicity_score": 0.0,
                "confidence": 1.0,
                "threshold": threshold,
                "model_version": version,
                "language": lang_key,
                "scope_notice": f"Local calibrated model for {task_info}."
            }

        cleaned = text.strip()
        proba = float(model.predict_proba([cleaned])[0, 1])
        is_toxic = bool(proba >= threshold)
        confidence = abs(proba - threshold) / max(threshold, 1.0 - threshold)

        return {
            "text": cleaned,
            "is_toxic": is_toxic,
            "toxicity_score": round(proba, 4),
            "confidence": round(min(confidence, 1.0), 4),
            "threshold": threshold,
            "model_version": version,
            "language": lang_key,
            "scope_notice": f"Local calibrated model for {task_info}."
        }


# Singleton helpers
_toxicity_predictor_instance = None
_multilingual_predictor_instance = None


def get_toxicity_predictor() -> ToxicityBaselinePredictor:
    global _toxicity_predictor_instance
    if _toxicity_predictor_instance is None:
        _toxicity_predictor_instance = ToxicityBaselinePredictor()
    return _toxicity_predictor_instance


def get_multilingual_predictor() -> MultilingualPredictor:
    global _multilingual_predictor_instance
    if _multilingual_predictor_instance is None:
        _multilingual_predictor_instance = MultilingualPredictor()
    return _multilingual_predictor_instance
