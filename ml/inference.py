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
            "default_threshold": 0.52,
            "default_version": "telugu_generalization_v3",
            "task": "Telugu Hate Speech & Harassment Classification"
        },
        "hindi": {
            "model_filename": "hindi_model.joblib",
            "config_filename": "hindi_config.json",
            "default_threshold": 0.54,
            "default_version": "hindi_word_char_v1",
            "task": "Hindi Social Media Hostility Classification"
        },
        "hinglish": {
            "model_filename": "hinglish_model.joblib",
            "config_filename": "hinglish_config.json",
            "default_threshold": 0.36,
            "default_version": "hinglish_contextual_v2",
            "task": "Hinglish Code-Mixed Hate Speech Classification (PRISM)"
        },
        "code_mixed": {
            "model_filename": "hinglish_model.joblib",
            "config_filename": "hinglish_config.json",
            "default_threshold": 0.36,
            "default_version": "hinglish_contextual_v2",
            "task": "Hinglish Code-Mixed Hate Speech Classification (PRISM)"
        },
        "kannada": {
            "model_filename": "kannada_model.joblib",
            "config_filename": "kannada_config.json",
            "default_threshold": 0.39,
            "default_version": "kannada_word_char_v2",
            "task": "Kannada Offensive & Harassment Classification"
        }
    }

    CATEGORY_CONFIGS = {
        "english": "english_categories.joblib",
        "hindi": "hindi_categories.joblib",
        "kannada": "kannada_categories.joblib",
        "telugu": "telugu_categories.joblib",
        "hinglish": "hinglish_categories.joblib",
        "code_mixed": "hinglish_categories.joblib",
    }

    def __init__(self, models_dir: str = MODELS_DIR):
        self.models_dir = models_dir
        self._loaded_models: Dict[str, Any] = {}
        self._loaded_cat_models: Dict[str, Any] = {}
        self._configs: Dict[str, Dict[str, Any]] = {}

    def warmup(self):
        """Pre-load and initialize all supported primary and category models into memory."""
        logger.info("Pre-warming all multilingual toxicity and category models...")
        for lang_key in ["english", "hindi", "telugu", "kannada", "hinglish"]:
            try:
                self._get_model(lang_key)
            except Exception as e:
                logger.warning(f"Could not warm up model for '{lang_key}': {e}")
            try:
                self._get_category_model(lang_key)
            except Exception as e:
                logger.warning(f"Could not warm up category model for '{lang_key}': {e}")

        # Warm up internal BLAS / scikit-learn pipeline caches with 1 fast dummy inference
        for lang_key in ["english", "hindi", "telugu", "kannada", "hinglish"]:
            try:
                self.predict("warmup", language=lang_key)
                self.predict_categories("warmup", language=lang_key)
            except Exception:
                pass
        logger.info("Multilingual models pre-warmed successfully.")

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

    def predict_batch(self, texts: List[str], language: str = "english") -> List[Dict[str, Any]]:
        """
        Fast vectorized batch inference for toxicity classification.
        Processes batches up to thousands of items in seconds via underlying BLAS.
        """
        lang_key = language.lower().strip()
        if lang_key in ("code_mixed", "code-mixed"):
            lang_key = "hinglish"
        if lang_key not in self.LANGUAGE_CONFIGS:
            lang_key = "english"

        spec = self.LANGUAGE_CONFIGS[lang_key]
        threshold = spec["default_threshold"]
        version = spec["default_version"]
        task_info = spec["task"]
        model = self._get_model(lang_key)

        clean_texts = [t.strip() if t and t.strip() else "" for t in texts]
        non_empty_indices = [i for i, t in enumerate(clean_texts) if t]
        
        results = [
            {
                "text": t,
                "is_toxic": False,
                "toxicity_score": 0.0,
                "confidence": 1.0,
                "threshold": threshold,
                "model_version": version,
                "language": lang_key,
                "scope_notice": f"Local calibrated model for {task_info}."
            }
            for t in clean_texts
        ]

        if non_empty_indices:
            sub_texts = [clean_texts[i] for i in non_empty_indices]
            probs = model.predict_proba(sub_texts)[:, 1]
            for idx, p in zip(non_empty_indices, probs):
                is_toxic = bool(p >= threshold)
                confidence = abs(p - threshold) / max(threshold, 1.0 - threshold)
                results[idx]["is_toxic"] = is_toxic
                results[idx]["toxicity_score"] = round(float(p), 4)
                results[idx]["confidence"] = round(float(min(confidence, 1.0)), 4)

        return results

    def _get_category_model(self, lang_key: str):
        canonical = lang_key.lower().strip()
        if canonical in ("code_mixed", "code-mixed"):
            canonical = "hinglish"
        if canonical in self._loaded_cat_models:
            return self._loaded_cat_models[canonical]
        if canonical not in self.CATEGORY_CONFIGS:
            return None
        fname = self.CATEGORY_CONFIGS[canonical]
        path = os.path.join(self.models_dir, fname)
        if not os.path.exists(path):
            return None
        try:
            m = joblib.load(path)
            self._loaded_cat_models[canonical] = m
            return m
        except Exception as e:
            logger.warning(f"Could not load category artifact for '{canonical}': {e}")
            return None

    def predict_categories(self, text: str, language: str = "english") -> Dict[str, Dict[str, Any]]:
        """
        Runs genuine category scoring across hate_speech, harassment, cyberbullying, legitimate.
        Returns dict of {category: {'score': float, 'supported': bool, 'note': Optional[str]}}.
        """
        lang_key = language.lower().strip()
        if lang_key in ("code_mixed", "code-mixed"):
            lang_key = "hinglish"

        all_categories = ["hate_speech", "harassment", "cyberbullying", "legitimate"]
        cat_model = self._get_category_model(lang_key)

        if not text or not text.strip():
            return {
                cat: {
                    "score": 1.0 if cat == "legitimate" else 0.0,
                    "supported": True if (cat_model and cat in cat_model.get("classifiers", {})) else (cat in ["hate_speech", "harassment", "legitimate"]),
                    "note": None if (cat_model and cat in cat_model.get("classifiers", {})) else ("Not available in this model" if cat == "cyberbullying" and lang_key in ("telugu", "hinglish") else None)
                }
                for cat in all_categories
            }

        cleaned = text.strip()
        if not cat_model:
            return {
                cat: {"score": 0.0, "supported": False, "note": "Category model not loaded"}
                for cat in all_categories
            }

        features = cat_model["features"]
        clfs = cat_model.get("classifiers", {})

        try:
            vec = features.transform([cleaned])
            res = {}
            for cat in all_categories:
                if cat in clfs:
                    proba = float(clfs[cat].predict_proba(vec)[0, 1])
                    res[cat] = {
                        "score": round(proba, 4),
                        "supported": True,
                        "note": None
                    }
                else:
                    res[cat] = {
                        "score": 0.0,
                        "supported": False,
                        "note": f"Category not annotated/supported for {lang_key}"
                    }
            return res
        except Exception as e:
            logger.warning(f"Category prediction error for '{lang_key}': {e}")
            return {
                cat: {"score": 0.0, "supported": False, "note": str(e)}
                for cat in all_categories
            }

    def predict_categories_batch(self, texts: List[str], language: str = "english") -> List[Dict[str, Dict[str, Any]]]:
        """
        Fast vectorized batch category prediction.
        Transforms all texts once and evaluates all category heads at matrix speed.
        """
        lang_key = language.lower().strip()
        if lang_key in ("code_mixed", "code-mixed"):
            lang_key = "hinglish"

        all_categories = ["hate_speech", "harassment", "cyberbullying", "legitimate"]
        cat_model = self._get_category_model(lang_key)

        clean_texts = [t.strip() if t and t.strip() else "" for t in texts]
        default_empty = {
            cat: {
                "score": 1.0 if cat == "legitimate" else 0.0,
                "supported": True if (cat_model and cat in cat_model.get("classifiers", {})) else (cat in ["hate_speech", "harassment", "legitimate"]),
                "note": None if (cat_model and cat in cat_model.get("classifiers", {})) else ("Not available in this model" if cat == "cyberbullying" and lang_key in ("telugu", "hinglish") else None)
            }
            for cat in all_categories
        }

        if not cat_model:
            return [
                {cat: {"score": 0.0, "supported": False, "note": "Category model not loaded"} for cat in all_categories}
                for _ in texts
            ]

        features = cat_model["features"]
        clfs = cat_model.get("classifiers", {})

        # Batch transform all texts
        try:
            vec_all = features.transform(clean_texts)
            # Evaluate all classifiers on the full matrix
            cat_probs = {}
            for cat in all_categories:
                if cat in clfs:
                    cat_probs[cat] = clfs[cat].predict_proba(vec_all)[:, 1]
                else:
                    cat_probs[cat] = None

            results = []
            for i, text in enumerate(clean_texts):
                if not text:
                    results.append(default_empty.copy())
                    continue
                item_res = {}
                for cat in all_categories:
                    if cat_probs[cat] is not None:
                        item_res[cat] = {
                            "score": round(float(cat_probs[cat][i]), 4),
                            "supported": True,
                            "note": None
                        }
                    else:
                        item_res[cat] = {
                            "score": 0.0,
                            "supported": False,
                            "note": f"Category not annotated/supported for {lang_key}"
                        }
                results.append(item_res)
            return results
        except Exception as e:
            logger.warning(f"Batch category prediction error for '{lang_key}': {e}")
            return [self.predict_categories(t, language=lang_key) for t in texts]


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
