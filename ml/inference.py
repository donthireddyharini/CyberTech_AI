"""
Sentinel AI - English Toxicity Baseline Inference Module
Provides a clean, reusable inference function for predicting toxicity on English text.
Loads the trained checkpoint from models/baseline_toxicity.joblib.

IMPORTANT SCOPING NOTICE:
This model is an English toxicity classification baseline trained on google/civil_comments.
It does NOT substitute for the multilingual hate-speech, harassment, and cyberbullying
decision pipeline required for CSEAIML2026-P03.
"""
import os
import joblib
from typing import Dict, Any, List

DEFAULT_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "models",
    "baseline_toxicity.joblib"
)

class ToxicityBaselinePredictor:
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
        """Returns True if the underlying model is successfully loaded."""
        return self._model is not None
        
    def predict(self, text: str, threshold: float = 0.40) -> Dict[str, Any]:
        """
        Predicts toxicity probability and binary flag for a given English text.
        Default threshold is 0.40, selected via validation set precision-recall trade-off.
        """
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

# Singleton helper
_predictor_instance = None

def get_toxicity_predictor() -> ToxicityBaselinePredictor:
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = ToxicityBaselinePredictor()
    return _predictor_instance
